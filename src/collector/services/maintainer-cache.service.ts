import { BadRequestException, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MaintainerService } from './maintainer.service';
import * as dayjs from 'dayjs';
import * as dayjsIsoWeek from 'dayjs/plugin/isoWeek';
import * as dayjsMinMax from 'dayjs/plugin/minMax';

import { cpus } from 'os';
import PromisePool from '@supercharge/promise-pool';

import type { MaintainerDataResponse } from '../controllers/compat.controller';
import { ConfigService } from '../../config/config.service';
import prisma from '../../prisma';

dayjs.extend(dayjsIsoWeek);
dayjs.extend(dayjsMinMax);

const percRegex = /^perc-(\d+(?:\.\d+)?)$/;
const getMapFromQuery = (
    query: string,
    data: { variants: string[]; data: [number, ...number[]][] }
): ((data: number[]) => number) | undefined => {
    if (query === 'sum' || query === 'avg') {
        const factor = query === 'sum' ? 1 : data.variants.length;
        return (row) => row.reduce((prev, next) => prev + next, 0) / factor;
    }

    const m = percRegex.exec(query);
    if (m) {
        const perc = Number.parseFloat(m[1]);
        const n = Math.round(perc * (data.variants.length - 1));

        return (row) => row.sort((a, b) => a - b)[n];
    }

    return undefined;
};

const filterRegex = /^(top|bot)-(\d+)$/;

const getFilterFromQuery = (
    query: string,
    resp: { variants: string[]; data: [number, ...number[]][] }
): number[] | undefined => {
    const match = filterRegex.exec(query);

    if (match) {
        const factor = match[1] === 'top' ? -1 : 1;
        const count = Number.parseInt(match[2]);

        if (resp.variants.length <= count) return undefined;

        const order = resp.variants
            .map((_, i) => [i, resp.data.reduce((v, row) => v + row[i + 1], 0)])
            .sort(([, a], [, b]) => (a - b) * factor);

        return order.slice(0, count).map(([i]) => i);
    }

    return undefined;
};

const precachable: {
    metric: string;
    map?: 'sum' | 'avg' | `perc-${number}`;
    filter?: `top-${number}`;
    resolution?: number;
    chunked?: boolean;
}[] = [
    { metric: 'HG_Rnd_Read_IOPS', map: 'sum' },
    { metric: 'HG_Rnd_Write_IOPS', map: 'sum' },
    { metric: 'HG_Seq_Write_IOPS', map: 'sum' },
    { metric: 'HG_Seq_Read_IOPS', map: 'sum' },
    { metric: 'HG_Read_TransRate', map: 'sum' },
    { metric: 'HG_Write_TransRate', map: 'sum' },
    { metric: 'HG_C2D_Trans', map: 'sum' },
    { metric: 'HG_D2CR_Trans', map: 'sum' },
    { metric: 'HG_D2CS_Trans', map: 'sum' },

    { metric: 'LDEV_Write_Response', map: 'avg' },
    { metric: 'LDEV_Read_Response', map: 'avg' },
    { metric: 'LDEV_Write_BlockSize', map: 'avg' },
    { metric: 'LDEV_Read_BlockSize', map: 'avg' },
    { metric: 'LDEV_Write_Hit', map: 'avg' },
    { metric: 'LDEV_Read_Hit', map: 'avg' },

    {
        metric: 'LDEV_Read_Response',
        filter: 'top-10',
        resolution: 4,
    },
    {
        metric: 'LDEV_Write_Response',
        filter: 'top-10',
        resolution: 4,
    },

    { metric: 'PHY_Short_MP', resolution: 5 },
    { metric: 'PHY_Short_MP', map: 'avg' },
    { metric: 'PHY_Short_MP', map: 'perc-1' },
    { metric: 'PHY_Short_PG' },
    { metric: 'PHY_Short_PG', map: 'avg' },
    { metric: 'PHY_Short_PG', map: 'perc-1' },
    { metric: 'PHY_Short_Write_Pending_Rate_Each_of_MPU' },
    { metric: 'PHY_Short_Write_Pending_Rate_Each_of_MPU', map: 'avg' },
    { metric: 'PHY_Short_Write_Pending_Rate_Each_of_MPU', map: 'perc-1' },

    { metric: 'HG_TransRate', map: 'sum' },
    { metric: 'HG_TransRate', filter: 'top-10' },
    { metric: 'HG_IOPS', map: 'sum' },
    { metric: 'HG_IOPS', filter: 'top-10' },
    { metric: 'HG_Read_Response', map: 'sum' },
    { metric: 'HG_Read_Response', filter: 'top-10' },
    { metric: 'HG_Write_Response', map: 'sum' },
    { metric: 'HG_Write_Response', filter: 'top-10' },

    { metric: 'CHB_KBPS' },
    { metric: 'PHY_Short_HIE_ISW', resolution: 5 },
    { metric: 'PHY_Short_MPU_HIE' },
    { metric: 'PHY_Short_Write_Pending_Rate' },
    { metric: 'PHY_Short_Cache_Usage_Rate_Each_of_MPU' },
];

const arraysEqual = <T>(a: T[], b: T[]): boolean => {
    if (a.length !== b.length) return false;

    return !a.some((val, idx) => b[idx] !== val);
};

const getCacheKey = (
    system: string,
    metric: string,
    qp: Partial<Record<'filter' | 'map', string>>
) => `${system};${metric};${qp.map};${qp.filter}`;

@Injectable()
export class MaintainerCacheService {
    constructor(
        private maintainerService: MaintainerService,
        private config: ConfigService
    ) {
        this.precache();
    }

    @Cron('0 0 */6 * * *')
    public async precache() {
        if (!this.config.getShouldPrefetch()) return;

        console.log('Precaching compat data');

        // ! for debugging: '2022-09-10 10:30'
        const range = [
            dayjs().startOf('day').subtract(1, 'month'),
            dayjs().startOf('minute'),
        ].map((a) => a.toDate()) as [Date, Date];

        console.time('precache');

        await PromisePool.withConcurrency(
            this.config.getMaxParallel() ?? cpus().length
        )
            .for(this.maintainerService.getHandledSystems())
            .process(async (system) => {
                if (!(await this.maintainerService.getStatus(system))) {
                    console.warn(
                        `Skipping precache for ${system} as it is not available`
                    );
                    return;
                }

                console.time(system);

                for (const pre of precachable) {
                    const key = getCacheKey(system, pre.metric, pre);

                    console.time(key);

                    try {
                        const { units, variants: underlyingVariants } =
                            await (pre.filter
                                ? this.maintainerService.getExtremalVariants(
                                      system,
                                      pre.metric,
                                      range,
                                      pre.filter
                                  )
                                : this.maintainerService.getRecommendedVariants(
                                      system,
                                      pre.metric,
                                      range
                                  ));

                        underlyingVariants.sort();
                        const variants = pre.map
                            ? [pre.map]
                            : underlyingVariants;

                        let existing =
                            await prisma.maintainerCacheEntry.findUnique({
                                where: { key },
                                select: {
                                    from: true,
                                    to: true,
                                    variants: true,
                                },
                            });

                        if (
                            existing &&
                            !arraysEqual(existing.variants, variants)
                        ) {
                            existing = undefined;
                        }

                        await prisma.maintainerCacheEntry.upsert({
                            where: { key },
                            create: {
                                key,
                                from: range[0],
                                to: range[1],
                                units,
                                variants,
                            },
                            update: {
                                from: range[0],
                                to: range[1],
                                variants,
                                data: {
                                    deleteMany: !existing
                                        ? {}
                                        : {
                                              timestamp: { lt: range[0] },
                                          },
                                },
                            },
                        });

                        for (let i = 0; !pre.chunked || i === 0; ++i) {
                            const start = dayjs(range[0]).add(i, 'weeks');

                            if (start >= dayjs(range[1])) break;

                            const _range = [
                                start,
                                pre.chunked
                                    ? dayjs(range[1])
                                    : dayjs.min(
                                          dayjs(range[1]),
                                          start.add(6, 'days').endOf('day')
                                      ),
                            ] as [dayjs.Dayjs, dayjs.Dayjs];

                            if (
                                existing &&
                                +_range[0] <= +existing.to &&
                                +_range[1] >= +existing.from
                            ) {
                                if (
                                    +_range[0] >= +existing.from &&
                                    +_range[1] <= +existing.to
                                )
                                    continue;
                                else if (
                                    +_range[0] <= +existing.from &&
                                    +_range[1] >= +existing.to
                                ) {
                                    // Nothing yet
                                } else if (+_range[0] < +existing.from)
                                    _range[1] = dayjs(existing.from);
                                else if (+_range[1] > +existing.to)
                                    _range[0] = dayjs(existing.to);
                            }

                            const result = await this.getData(
                                system,
                                pre.metric,
                                _range.map((d) => d.toDate()) as [Date, Date],
                                {
                                    map: pre.map,
                                    filter: pre.filter,
                                    variants: underlyingVariants,
                                },
                                true
                            );

                            if (pre.resolution) {
                                let prev = 0;
                                result.data = result.data.filter(([time]) => {
                                    if (time - prev >= pre.resolution) {
                                        prev = time;
                                        return true;
                                    }

                                    return false;
                                });
                            }

                            const data = result.data
                                .filter(([, val]) => val !== undefined)
                                .map((row) => ({
                                    timestamp: new Date(row[0] * 60_000),
                                    values: row,
                                }));

                            console.time(key + ':db_write');
                            await prisma.maintainerCacheEntry.update({
                                where: { key },
                                data: {
                                    ...(pre.filter
                                        ? { variants: result.variants }
                                        : {}),
                                    data: {
                                        createMany: {
                                            data,
                                            skipDuplicates: true,
                                        },
                                    },
                                },
                            });
                            console.timeEnd(key + ':db_write');
                        }
                    } catch (err) {
                        console.error(
                            `Failed to precache ${pre.metric} for ${system}: ${err?.message}`
                        );
                    }

                    console.timeEnd(key);
                }

                console.timeEnd(system);
            });

        console.timeEnd('precache');
    }

    public async getData(
        system: string,
        metric: string,
        range: [Date, Date],
        qp: { map?: string; filter?: string; variants?: string[] },
        ignoreCache?: boolean
    ): Promise<MaintainerDataResponse> {
        if (!this.maintainerService.handlesSystem(system)) {
            throw new BadRequestException(
                "System doesn't exist or is not handled by a maintainer"
            );
        }

        const cacheEntry = ignoreCache
            ? undefined
            : await prisma.maintainerCacheEntry.findUnique({
                  where: { key: getCacheKey(system, metric, qp) },
              });

        if (!ignoreCache)
            console.log(`cache ${cacheEntry ? 'hit' : 'MISS'} for ${metric}`);

        if (cacheEntry && cacheEntry.from <= range[0]) {
            const data = (
                await prisma.maintainerCacheRows.findMany({
                    where: {
                        entryKey: cacheEntry.key,
                        timestamp: { gte: range[0], lte: range[1] },
                    },
                    select: { values: true },
                    orderBy: { timestamp: 'asc' },
                })
            ).map(({ values }) => values as [number, ...number[]]);

            return {
                variants: cacheEntry.variants,
                units: cacheEntry.units,
                data,
            };
        }

        if (!ignoreCache)
            console.warn(`cache MISS for ${metric};${qp.map};${qp.filter}`);

        if (['avg', 'sum'].includes(qp.map) && !qp.filter) {
            return await this.maintainerService.getMaintainerData(
                system,
                metric,
                range,
                { op: qp.map as 'avg' | 'sum' }
            );
        }

        let resp = await this.maintainerService.getMaintainerData(
            system,
            metric,
            range,
            { variants: qp.variants }
        );

        const filter = getFilterFromQuery(qp.filter, resp);

        if (filter) {
            resp = {
                units: resp.units,
                variants: filter.map((i) => resp.variants[i]),
                data: resp.data.map(([key, ...data]) => [
                    key,
                    ...filter.map((i) => data[i]),
                ]),
            };
        }

        const map = getMapFromQuery(qp.map, resp);

        if (map) {
            resp = {
                units: resp.units,
                variants: [qp.map],
                data: resp.data.map(([key, ...values]) => [key, map(values)]),
            };
        }

        return resp;
    }
}
