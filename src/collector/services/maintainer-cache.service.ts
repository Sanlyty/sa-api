import { BadRequestException, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MaintainerService } from './maintainer.service';
import * as dayjs from 'dayjs';
import * as dayjsIsoWeek from 'dayjs/plugin/isoWeek';

import type { MaintainerDataResponse } from '../controllers/compat.controller';
import { performance } from 'perf_hooks';

dayjs.extend(dayjsIsoWeek);

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
        const order = resp.variants
            .map((_, i) => [i, resp.data.reduce((v, row) => v + row[i + 1], 0)])
            .sort(([, a], [, b]) => (a - b) * factor);

        return order.slice(0, Number.parseInt(match[2])).map(([i]) => i);
    }

    return undefined;
};

const precachable: { metric: string; map?: string; filter?: string }[] = [
    { metric: 'LDEV_Rnd_Read_IOPS', map: 'sum' },
    { metric: 'LDEV_Rnd_Write_IOPS', map: 'sum' },
    { metric: 'LDEV_Seq_Write_IOPS', map: 'sum' },
    { metric: 'LDEV_Seq_Read_IOPS', map: 'sum' },
    { metric: 'LDEV_Read_TransRate', map: 'sum' },
    { metric: 'LDEV_Write_TransRate', map: 'sum' },
    { metric: 'LDEV_C2D_Trans', map: 'sum' },
    { metric: 'LDEV_D2CR_Trans', map: 'sum' },
    { metric: 'LDEV_D2CS_Trans', map: 'sum' },

    { metric: 'LDEV_Write_Response', map: 'avg' },
    { metric: 'LDEV_Read_Response', map: 'avg' },
    { metric: 'LDEV_Write_BlockSize', map: 'avg' },
    { metric: 'LDEV_Read_BlockSize', map: 'avg' },
    { metric: 'LDEV_Write_Hit', map: 'avg' },
    { metric: 'LDEV_Read_Hit', map: 'avg' },

    { metric: 'PHY_Short_MP' },
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
    { metric: 'HG_Read_Response', map: 'avg' },
    { metric: 'HG_Read_Response', map: 'sum' },
    { metric: 'HG_Read_Response', filter: 'top-10' },
    { metric: 'HG_Write_Response', map: 'avg' },
    { metric: 'HG_Write_Response', map: 'sum' },
    { metric: 'HG_Write_Response', filter: 'top-10' },
];

const getCacheKey = (
    system: string,
    metric: string,
    qp: Partial<Record<'filter' | 'map', string>>
) => `${system};${metric};${qp.map};${qp.filter}`;

@Injectable()
export class MaintainerCacheService {
    private _cachedSince = new Date();
    private _cache: {
        [key: string]: MaintainerDataResponse;
    } = {};

    constructor(private maintainerService: MaintainerService) {
        this.precache();
    }

    @Cron('0 0 */6 * * *')
    public async precache() {
        console.log('Precaching compat data');

        const nextCache: typeof this._cache = {};
        const range = [
            dayjs().startOf('day').subtract(1, 'month'),
            dayjs().endOf('day').startOf('second'),
        ].map((a) => a.toDate()) as [Date, Date];

        const start = performance.now();

        await Promise.all(
            this.maintainerService.getHandledSystems().map(async (system) => {
                for (const pre of precachable) {
                    const key = getCacheKey(system, pre.metric, pre);

                    nextCache[key] = await this.getData(
                        system,
                        pre.metric,
                        range,
                        { map: pre.map, filter: pre.filter }
                    );
                }
            })
        );

        console.log(`Precache completed in ${performance.now() - start} ms`);

        this._cache = nextCache;
        this._cachedSince = new Date(range[0]);
    }

    public async getData(
        system: string,
        metric: string,
        range: [Date, Date],
        qp: { map?: string; filter?: string }
    ): Promise<MaintainerDataResponse> {
        if (!this.maintainerService.handlesSystem(system)) {
            throw new BadRequestException(
                "System doesn't exist or is not handled by a maintainer"
            );
        }

        const cacheKey = getCacheKey(system, metric, qp);

        if (this._cache[cacheKey] && this._cachedSince <= range[0]) {
            const { variants, data } = this._cache[cacheKey];
            return {
                variants,
                data: data.filter(
                    ([v]) => v >= +range[0] / 60_000 && v <= +range[1] / 60_000
                ),
            };
        }

        let resp = await this.maintainerService.getMaintainerData(
            system,
            metric,
            range
        );

        const filter = getFilterFromQuery(qp.filter, resp);

        if (filter) {
            resp = {
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
                variants: [qp.map],
                data: resp.data.map(([key, ...values]) => [key, map(values)]),
            };
        }

        return resp;
    }
}
