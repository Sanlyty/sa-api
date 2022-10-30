import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { readFileSync } from 'fs';
import { StorageEntityEntity } from '../entities/storage-entity.entity';
import { lastValueFrom } from 'rxjs';
import { MetricType } from '../enums/metric-type.enum';
import { Cron } from '@nestjs/schedule';
// import { load_data } from '../../../libreader/pkg/libreader';

type Dataset = {
    id: string;
    category: string[];
    units: string;
    xType: string;
    yType: string;
};

@Injectable()
export class MaintainerService {
    private maintainerMap: Record<string, string> = {};
    private datasets: Record<string, Dataset[]> = {};

    constructor(private httpService: HttpService) {
        this.maintainerMap = process.env.CONF_MAINTAINER_MAP
            ? JSON.parse(
                  readFileSync(`${process.env.CONF_MAINTAINER_MAP}`, {
                      encoding: 'utf8',
                  })
              )
            : {};

        this.updateDatasets();
    }

    @Cron('0 0 * * *')
    public async updateDatasets() {
        await Promise.all(
            Object.entries(this.maintainerMap).map(async ([system, url]) => {
                this.datasets[system] = await lastValueFrom(
                    this.httpService.get(url + 'datasets')
                ).then((d) => d.data);
            })
        );
    }

    public handlesSystem(id: string): boolean {
        return id in this.maintainerMap;
    }

    public getHandledSystems(): string[] {
        return Object.keys(this.maintainerMap);
    }

    public async getStatus(
        system: string
    ): Promise<
        { type: string; version: string; features: string[] } | undefined
    > {
        if (!this.handlesSystem(system)) return undefined;

        let response;

        try {
            response = await lastValueFrom(
                this.httpService.get(this.maintainerMap[system])
            );
        } catch {
            return undefined;
        }

        return response.status === 200 ? response.data : undefined;
    }

    public async getDatasetInfo(
        system: string,
        dataset: string
    ): Promise<Dataset | undefined> {
        const local = this.datasets[system]?.find((d) => d.id === dataset);

        if (local) return local;

        return await lastValueFrom(
            this.httpService.get(
                this.maintainerMap[system] + 'datasets/' + dataset
            )
        ).then((r) => r.data);
    }

    public async getLatencyAnalysisDates(systemId: string): Promise<string[]> {
        const maintainerUrl = this.maintainerMap[systemId];

        return (
            await lastValueFrom(
                this.httpService.post(
                    `${maintainerUrl}features/latency_analysis_dates`
                )
            )
        ).data;
    }

    public async getLatencyAnalysis(
        systemId: string,
        poolName: string,
        op: 'READ' | 'WRITE',
        dates: string[]
    ): Promise<[number, number, number][]> {
        const maintainerUrl = this.maintainerMap[systemId];

        return (
            await lastValueFrom(
                this.httpService.post(
                    `${maintainerUrl}features/latency_analysis`,
                    {
                        op,
                        dates,
                        pool: poolName,
                    }
                )
            )
        ).data;
    }

    public async getPGEvents(
        systemId: string,
        from?: number,
        to?: number
    ): Promise<{
        up_to: number;
        events: {
            from: number;
            to: number;
            average: number;
            peak: number;
            key: string;
        }[];
    }> {
        const maintainerUrl = this.maintainerMap[systemId];

        return (
            await lastValueFrom(
                this.httpService.post(`${maintainerUrl}features/pg_events`, {
                    from,
                    to,
                })
            )
        ).data;
    }

    public async getChbInfo(systemId: string): Promise<{
        chbPairs: [string, string][];
        portPairs: [string, string][];
        chbPorts: Record<string, string[]>;
    }> {
        const maintainerUrl = this.maintainerMap[systemId];

        return (
            await lastValueFrom(
                this.httpService.post(`${maintainerUrl}features/chb_info`)
            )
        ).data;
    }

    public async getPoolInfo(systemId: string): Promise<{
        [poolId: string]: {
            id: number;
            name: string;
            eccGroups: string[];
            ldevs: string[];
        };
    }> {
        const maintainerUrl = this.maintainerMap[systemId];

        return (
            await lastValueFrom(
                this.httpService.post(`${maintainerUrl}features/pool_info`)
            )
        ).data;
    }

    public async getFePorts(systemId: string): Promise<{
        [port: string]: {
            speed: number;
            description: string;
            cables: string;
            switch: string;
            covers: string[];
            automation: boolean;
            slot_port: string;
            wwn?: string;
            san_env?: string;
        };
    }> {
        const maintainerUrl = this.maintainerMap[systemId];

        return (
            await lastValueFrom(
                this.httpService.post(`${maintainerUrl}features/fe_ports`)
            )
        ).data;
    }

    public async getSLAEvents(
        systemId: string,
        from?: number,
        to?: number
    ): Promise<{ [pool: string]: { count: number; duration: number } }> {
        const maintainerUrl = this.maintainerMap[systemId];

        return (
            await lastValueFrom(
                this.httpService.post(`${maintainerUrl}features/sla`, {
                    from,
                    to,
                })
            )
        ).data;
    }

    public async getMetricsForEntities(
        systemId: string,
        entities: StorageEntityEntity[],
        dataKeySelector: MetricColSelector,
        options: {
            additionalKeys?: Record<string, MetricColSelector>;
            metrics: {
                id: string;
                metric?: string;
                unit: string;
                type: MetricType;
                preproc?: (val: number) => number;
            }[];
        }
    ) {
        const metricData: Record<
            string,
            { data: LastMaintainerData; unit: string; type: MetricType }
        > = {};

        for (const metric of options.metrics) {
            const data = await this.getLastMaintainerData(
                systemId,
                metric.metric ?? metric.id
            );

            if (metric.preproc) {
                for (const key in data.cols) {
                    data.cols[key] = metric.preproc(data.cols[key]);
                }
            }

            metricData[metric.id] = {
                data,
                unit: metric.unit,
                type: metric.type,
            };
        }

        entities.forEach((e) => {
            // Retain skipped metrics
            e.metrics = Object.keys(metricData).map((metricId) => {
                const mData = metricData[metricId];

                const result = {
                    id: -1,
                    metricTypeEntity: {
                        id: mData.type,
                        name: metricId,
                        unit: mData.unit,
                        threshold: undefined,
                        idCatMetricGroup: undefined,
                    },
                    date: mData.data.date,
                    value: mData.data.cols[dataKeySelector(e, metricId)] ?? 0,
                };

                // Assign additional keys other than 'value'
                for (const additional in options?.additionalKeys) {
                    result[additional] =
                        mData.data.cols[
                            options.additionalKeys[additional](e, metricId)
                        ] ?? 0;
                }

                return result;
            });
        });
    }

    public async getRanges(
        id: string,
        metric?: string
    ): Promise<[Date, Date][]> {
        if (!this.handlesSystem(id)) {
            return undefined;
        }

        const url =
            this.maintainerMap[id] +
            (metric ? 'datasets/' + metric : 'ranges/');

        const { data } = await lastValueFrom(this.httpService.get(url));

        return (metric ? data.dataranges : data).map((d) =>
            d.map((d) => new Date(d * 60_000))
        );
    }

    public async recommendVariants(
        system: string,
        metric: string,
        range: [Date, Date],
        extremals?: {
            filter: `${'top' | 'bot'}-${number}`;
            variants?: string[];
        }
    ): Promise<string[]> {
        if (!this.handlesSystem(system)) {
            return undefined;
        }

        let url = this.maintainerMap[system];
        const [from, to] = range.map((d) => Math.round(+d / 60_000).toString());
        let trail = {};

        if (extremals) {
            const { filter, variants } = extremals;
            const [_agg, _count] = filter.split('-');

            trail = {
                agg: _agg[0].toUpperCase() + _agg.slice(1),
                count: Number.parseInt(_count),
                ...(variants ? { variants } : {}),
            };
            url += 'extremals';
        } else {
            url += 'features/variant_recommend';
        }

        return (
            await lastValueFrom(
                this.httpService.post(url, {
                    ...trail,
                    id: metric,
                    from,
                    to,
                })
            )
        ).data;
    }

    public async getMaintainerData(
        system: string,
        metric: string,
        durationOrRange: number | [Date, Date],
        options?: {
            variants?: string[];
            op?: 'sum' | 'avg';
        }
    ): Promise<{
        variants: string[];
        units: string;
        data: [number, ...number[]][];
    }> {
        if (!this.handlesSystem(system)) {
            return undefined;
        }

        const maintainerUrl = this.maintainerMap[system];

        let range: [Date, Date];
        let units: string;

        if (Array.isArray(durationOrRange)) {
            range = durationOrRange;
            units = (await this.getDatasetInfo(system, metric)).units;
        } else {
            const response = (
                await lastValueFrom(
                    this.httpService.get(`${maintainerUrl}datasets/${metric}`)
                )
            ).data as { dataranges: number[][]; units: string };

            units = response.units;
            const lastDate =
                response.dataranges.reverse()[0]?.[1] ??
                new Date().getTime() / 60_000;

            range = [lastDate - durationOrRange, lastDate].map(
                (i) => new Date(i * 60_000)
            ) as [Date, Date];
        }

        // TODO: use maintainer autorecommendation instead
        const variants =
            options?.variants ??
            (await this.recommendVariants(system, metric, range));
        const [from, to] = range.map((d) => Math.round(+d / 60_000).toString());

        const data = (
            await lastValueFrom(
                this.httpService.post(
                    `${maintainerUrl}bulkload_json/${metric}`,
                    {
                        variants,
                        from,
                        to,
                        op: options?.op,
                    }
                    // { responseType: 'arraybuffer' }
                )
            )
        ).data;

        return {
            variants: options?.op ? [options.op] : variants,
            units,
            data,
            // data: load_data(new Uint8Array(data), yType, variants) as [
            //     number,
            //     ...number[]
            // ][],
        };
    }

    public async getLastMaintainerData(
        id: string,
        metric: string,
        options?: {
            variants?: string[];
        }
    ): Promise<LastMaintainerData | undefined> {
        if (!this.handlesSystem(id)) {
            return undefined;
        }

        const { variants, data } = await this.getMaintainerData(
            id,
            metric,
            1,
            options
        );

        if (variants.length === 0 || data.length === 0) {
            return {
                date: new Date(),
                cols: {},
            };
        }

        return {
            date: new Date(Number(data[0][0]) * 60_000),
            cols: variants.reduce(
                (p, k, i) => ({ ...p, [k]: data[0][i + 1] }),
                {}
            ),
        };
    }
}

type LastMaintainerData = {
    date: Date;
    cols: Record<string, number>;
};

type MetricColSelector = (e: StorageEntityEntity, metricName: string) => string;
