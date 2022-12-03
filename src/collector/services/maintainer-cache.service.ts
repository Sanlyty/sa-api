import { BadRequestException, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import dayjsIsoWeek from 'dayjs/plugin/isoWeek';
import dayjsMinMax from 'dayjs/plugin/minMax';

import PromisePool from '@supercharge/promise-pool';
import { pool } from 'workerpool';
import { encode } from 'lz4';

import { MaintainerService, type UpdatedInfo } from './maintainer.service';
import type { MaintainerDataResponse } from '../controllers/compat.controller';
import { ConfigService } from '../../config/config.service';
import { fromMins, toMins } from '../../../utils/date';

// Node
import { cpus } from 'os';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

dayjs.extend(dayjsIsoWeek);
dayjs.extend(dayjsMinMax);

const SummaryFile = 'meta.json';
const MapFile = 'blobmap.json';
const BlobFile = (i: number) => `${i}.blob`;

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
const customMetricRegex = /\$(\w+)@(pool)-(\w+)/;

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

type CacheEntry = {
    range: [number, number];
    variants: string[];
    units: string;
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

    { metric: 'LDEV_Read_BlockSize', map: 'avg' },
    { metric: 'LDEV_Read_Hit', map: 'avg' },
    { metric: 'LDEV_Read_Response', map: 'avg' },
    { metric: 'LDEV_Write_BlockSize', map: 'avg' },
    { metric: 'LDEV_Write_Hit', map: 'avg' },
    { metric: 'LDEV_Write_Response', map: 'avg' },

    { metric: 'PHY_Short_MP', resolution: 5 },
    { metric: 'PHY_Short_MP', map: 'avg' },
    { metric: 'PHY_Short_PG' },
    { metric: 'PHY_Short_PG', map: 'avg' },
    { metric: 'PHY_Short_Write_Pending_Rate_Each_of_MPU' },
    { metric: 'PHY_Short_Write_Pending_Rate_Each_of_MPU', map: 'avg' },

    { metric: 'HG_TransRate', map: 'sum' },
    { metric: 'HG_TransRate', filter: 'top-10' },
    { metric: 'HG_IOPS', map: 'sum' },
    { metric: 'HG_IOPS', filter: 'top-10' },
    { metric: 'HG_Read_IOPS', map: 'sum' },
    { metric: 'HG_Write_IOPS', map: 'sum' },
    { metric: 'HG_Read_Response', filter: 'top-10' },
    { metric: 'HG_Write_Response', filter: 'top-10' },

    { metric: 'CHB_KBPS' },
    { metric: 'PHY_Short_HIE_ISW', resolution: 5 },
    { metric: 'PHY_Short_MPU_HIE' },
    { metric: 'PHY_Short_Write_Pending_Rate' },
];

const arraysEqual = <T>(a: T[], b: T[]): boolean => {
    if (a.length !== b.length) return false;

    return !a.some((val, idx) => b[idx] !== val);
};

const getCacheKey = (
    metric: string,
    qp: Partial<Record<'filter' | 'map', string>>
) => `${metric};${qp.map};${qp.filter}`;

@Injectable()
export class MaintainerCacheService {
    private vmwCache: Record<string, { variant: string }[]> = {};
    private systemLocks: Record<string, boolean> = {};
    private pool = pool(__dirname + '/maintainer-cache.worker.js');

    constructor(
        private maintainerService: MaintainerService,
        private config: ConfigService
    ) {
        this.maintainerService.loaded.then(async () => {
            await this.precache();
            this.maintainerService.events.on('updated', (info: UpdatedInfo) => {
                if (info.type === 'hp') {
                    this.prefetchSystem(info.system, this.prefferedRangeStart);
                }
            });
        });
    }

    get cachePath(): string {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.config.getCachePath()!;
    }

    get prefferedRangeStart(): dayjs.Dayjs {
        return dayjs(this.config.getDebugPrefetchDate())
            .startOf('day')
            .subtract(1, 'month');
    }

    public async precache() {
        if (!this.cachePath) return;

        console.log('Precaching compat data');

        const rangeStart = this.prefferedRangeStart;

        console.time('initial precache');

        try {
            // Process systems in parallel
            await PromisePool.withConcurrency(
                this.config.getMaxParallel() ?? cpus().length
            )
                .for(await this.maintainerService.getHandledSystems(['hp']))
                .process(async (system) =>
                    this.prefetchSystem(system, rangeStart)
                );
        } finally {
            console.timeEnd('initial precache');
        }
    }

    private async prefetchSystem(
        system: string,
        rangeStart: dayjs.Dayjs
    ): Promise<void> {
        if (!(await this.maintainerService.getStatus(system))) {
            console.warn(
                `Skipping precache for ${system}: maintainer unavailable`
            );
            return;
        }

        if (this.systemLocks[system]) return;
        this.systemLocks[system] = true;

        console.time(system);

        this.vmwCache[system] = await this.getVmws(system, true);

        // Process metrics sequentially
        for (const pre of precachable) {
            const key = getCacheKey(pre.metric, pre);
            const metricRoot = join(this.cachePath, system, key);
            await fs.mkdir(metricRoot, { recursive: true });

            const timeKey = system + ';' + key;
            console.time(timeKey);

            try {
                const avail = await this.maintainerService
                    .getRanges(system, pre.metric)
                    .then((r) => r.at(-1)?.at(1));
                if (!avail) continue;

                // Ignore if out of scope
                if (+rangeStart > +avail) continue;

                const summaryPath = join(metricRoot, SummaryFile);
                const cacheEntry: CacheEntry | undefined = existsSync(
                    summaryPath
                )
                    ? JSON.parse(await fs.readFile(summaryPath, 'utf-8'))
                    : undefined;

                // Ignore if existing more recent
                if (cacheEntry && cacheEntry.range[1] >= +avail) continue;

                const range: [Date, Date] = [
                    rangeStart.toDate(),
                    new Date(avail),
                ];

                const underlyingVariants =
                    await this.maintainerService.recommendVariants(
                        system,
                        pre.metric,
                        range,
                        pre.filter ? { filter: pre.filter } : undefined
                    );

                underlyingVariants.sort();
                const variants = pre.map ? [pre.map] : underlyingVariants;

                const units = (
                    await this.maintainerService.getDatasetInfo(
                        system,
                        pre.metric
                    )
                ).units;

                let fetchFrom = rangeStart.clone();
                let data: [number, ...number[]][] = [];

                // Load existing data from cache
                if (cacheEntry && arraysEqual(cacheEntry.variants, variants)) {
                    fetchFrom = dayjs.max(
                        fetchFrom,
                        dayjs(cacheEntry.range[1]).add(1, 'minute')
                    );

                    data = await this.readFromBlob(metricRoot, [
                        rangeStart.toDate(),
                        new Date(cacheEntry.range[1]),
                    ]);
                }

                const result = await this.getData(
                    system,
                    pre.metric,
                    [fetchFrom.toDate(), avail],
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

                data.push(
                    ...result.data.filter(([, val]) => val !== undefined)
                );

                // remove previous blobs
                await fs
                    .readdir(metricRoot)
                    .then((dir) =>
                        Promise.all(
                            dir
                                .filter((f) => f.endsWith('.blob'))
                                .map((f) => fs.unlink(join(metricRoot, f)))
                        )
                    );
                await this.writeToBlob(metricRoot, data);

                await fs.writeFile(
                    summaryPath,
                    JSON.stringify({
                        range: [+rangeStart, +avail],
                        variants,
                        units,
                    } satisfies CacheEntry),
                    'utf-8'
                );
            } catch (err) {
                console.error(
                    `Failed to precache ${pre.metric} for ${system}: ${err?.message}`
                );
            }

            console.timeEnd(timeKey);
        }

        console.timeEnd(system);
        delete this.systemLocks[system];
    }

    public async getVmws(
        system: string,
        ignoreCache?: boolean
    ): Promise<{ variant: string }[]> {
        if (!ignoreCache && system in this.vmwCache)
            return this.vmwCache[system];

        const metricName = 'VMW_NET_TOTAL';
        const ranges = await this.maintainerService.getRanges(
            system,
            metricName
        );

        if (ranges.length === 0) return [];

        const result = await this.maintainerService.getMaintainerData(
            system,
            metricName,
            60 * 24 * 7
        );

        return result.variants
            .filter((_, i) => result.data.some((row) => row[i + 1] > 0))
            .map((variant) => ({ variant }));
    }

    private async readFromBlob(
        dir: string,
        range?: [Date, Date]
    ): Promise<[number, ...number[]][]> {
        const chunkMap: Record<string, [number, number]> = JSON.parse(
            await fs.readFile(join(dir, MapFile), 'utf-8')
        );
        const result: [number, ...number[]][] = [];

        for (const [fname, [fFrom, fTo]] of Object.entries(chunkMap)) {
            if (range && (+range[1] < fFrom || +range[0] > fTo)) continue;

            const data = await this.pool.exec('load', [
                await fs.readFile(join(dir, fname)),
            ]);

            if (range && (+range[1] < fTo || +range[0] > fFrom)) {
                const [a, b] = [toMins(range[0]), toMins(range[1])];
                result.push(
                    ...data.filter(([stamp]) => stamp >= a && stamp <= b)
                );
            } else {
                result.push(...data);
            }
        }

        return result;
    }

    private async writeToBlob(
        dir: string,
        data: [number, ...number[]][]
    ): Promise<void> {
        const chunking = 60 * 24 * 5;
        const chunkMap: Record<string, [number, number]> = {};

        for (let i = 0; i < Math.ceil(data.length / chunking); ++i) {
            const [fromIdx, toIdx] = [
                i * chunking,
                Math.min((i + 1) * chunking, data.length),
            ];
            const fileName = BlobFile(i);

            chunkMap[fileName] = [
                +fromMins(data[fromIdx][0]),
                +fromMins(data[toIdx - 1][0]),
            ];

            await fs.writeFile(
                join(dir, fileName),
                encode(Buffer.from(JSON.stringify(data.slice(fromIdx, toIdx))))
            );
        }

        await fs.writeFile(
            join(dir, MapFile),
            JSON.stringify(chunkMap),
            'utf-8'
        );
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

        const summaryPath = join(
            this.cachePath,
            system,
            getCacheKey(metric, qp),
            SummaryFile
        );
        const cacheEntry: CacheEntry =
            ignoreCache || !existsSync(summaryPath)
                ? undefined
                : JSON.parse(await fs.readFile(summaryPath, 'utf-8'));

        if (cacheEntry && cacheEntry.range[0] <= +range[0]) {
            return {
                variants: cacheEntry.variants,
                units: cacheEntry.units,
                data: await this.readFromBlob(
                    join(this.cachePath, system, getCacheKey(metric, qp)),
                    range
                ),
            };
        }

        if (!ignoreCache)
            console.warn(`cache MISS for ${metric};${qp.map};${qp.filter}`);

        let resp;
        let variants: string[] | undefined = qp.variants;

        const matches = metric.match(customMetricRegex);
        if (matches) {
            const [, _metric, mode, params] = matches;

            metric = _metric;

            switch (mode) {
                case 'pool':
                    variants = await this.maintainerService
                        .getPoolInfo(system)
                        .then((p) =>
                            p[params].ldevs.map((l) => l.toUpperCase() + 'X')
                        );

                    if (qp.filter) {
                        variants =
                            await this.maintainerService.recommendVariants(
                                system,
                                metric,
                                range,
                                { filter: qp.filter as 'top-1', variants }
                            );
                    }
                    break;
                default:
                    throw new Error(`Unknown mode '${mode}'`);
            }
        }

        if (['avg', 'sum'].includes(qp.map) && !qp.filter) {
            return await this.maintainerService.getMaintainerData(
                system,
                metric,
                range,
                { op: qp.map as 'avg' | 'sum', variants }
            );
        }

        resp = await this.maintainerService.getMaintainerData(
            system,
            metric,
            range,
            { variants }
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
