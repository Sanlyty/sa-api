import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { readFileSync } from 'fs';
import { lastValueFrom } from 'rxjs';
import { WebSocket as WSClient } from 'ws';
import { EventEmitter } from 'events';

import { MetricType } from '../enums/metric-type.enum';
import { StorageEntityEntity } from '../entities/storage-entity.entity';
import { ConfigService } from '../../config/config.service';
import { fromMins, toMins } from '../../utils/date';

export type Dataset = {
    id: string;
    category: string[];
    units: string;
    xType: string;
    yType: string;
};

export type MaintainerInfo = {
    type: string;
    version: string;
    features: string[];
};

type MaintainerInfoInternal = MaintainerInfo & {
    datasets: Dataset[];
    ws: WSClient;
};

export type UpdatedInfo = MaintainerInfo & {
    system: string;
};

/// Supported network protocols for maintainer connections
const knownProtos = ['http:', 'https:'];

// TODO: move to fetch API
@Injectable()
export class MaintainerService {
    private maintainerMap: Record<string, string>;
    private maintainerInfo: Record<string, MaintainerInfoInternal> = {};
    public events: EventEmitter = new EventEmitter();
    public loaded: Promise<void>;

    constructor(
        private httpService: HttpService,
        private config: ConfigService
    ) {
        const path = config.getMaintainerConfPath();
        this.maintainerMap = path
            ? Object.fromEntries(
                  Object.entries(JSON.parse(readFileSync(path, 'utf8'))).map(
                      ([k, v]) => {
                          const parsed = new URL(v as string);
                          if (!knownProtos.includes(parsed.protocol))
                              throw new Error(
                                  `Invalid protocol '${parsed.protocol}'`
                              );

                          let url = parsed.toString();
                          if (!url.endsWith('/')) url += '/';
                          return [k, url];
                      }
                  )
              )
            : {};

        this.loaded = Promise.all(
            Object.keys(this.maintainerMap).map((s) =>
                this.updateMaintainerInfo(s)
            )
        ).then(() => {
            this.events.emit('loaded');
        });
    }

    private async updateMaintainerInfo(system: string) {
        const url = this.maintainerMap[system];

        try {
            const info = await lastValueFrom(this.httpService.get(url)).then(
                (d) => d.data
            );
            const datasets = await lastValueFrom(
                this.httpService.get(url + 'datasets')
            ).then((d) => d.data);

            let ws = this.maintainerInfo[system]?.ws;

            if (!ws) {
                const wsUrl = new URL('connect', url);
                wsUrl.protocol = wsUrl.protocol.replace('http', 'ws');

                console.debug('connecting to', wsUrl.toString());
                ws = new WSClient(wsUrl);
                ws.on('message', () => {
                    console.debug(`received update message from ${system}`);
                    this.updateMaintainerInfo(system);
                });
                ws.on('close', () => {
                    delete this.maintainerInfo[system];
                    this.updateMaintainerInfo(system);
                });
            }

            this.maintainerInfo[system] = {
                ...info,
                datasets,
                ws,
            };

            this.events.emit('updated', {
                ...info,
                system,
            } satisfies UpdatedInfo);
            return true;
        } catch (_) {
            if (system in this.maintainerInfo) {
                try {
                    this.maintainerInfo[system].ws.removeAllListeners().close();
                } catch (err) {
                    console.error('Failed to unregister ws', err);
                }
                delete this.maintainerInfo[system];
            }

            setTimeout(() => this.updateMaintainerInfo(system), 10_000);
        }

        return false;
    }

    public handlesSystem(id: string): boolean {
        return id in this.maintainerMap;
    }

    public getHandledSystems(ofType: string[]): string[] {
        return Object.entries(this.maintainerInfo)
            .map(([k, v]) => (ofType.includes(v.type) ? k : undefined))
            .filter((v) => v);
    }

    public async getStatus(
        system: string
    ): Promise<MaintainerInfo | undefined> {
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
        const local = this.maintainerInfo[system]?.datasets.find(
            (d) => d.id === dataset
        );

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
                    maintainerUrl + 'features/latency_analysis_dates'
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
                    maintainerUrl + 'features/latency_analysis',
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
                this.httpService.post(maintainerUrl + 'features/pg_events', {
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
                this.httpService.post(maintainerUrl + 'features/chb_info')
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
                this.httpService.post(maintainerUrl + 'features/pool_info')
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
                this.httpService.post(maintainerUrl + 'features/fe_ports')
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
                this.httpService.post(maintainerUrl + 'features/sla', {
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
            this.maintainerMap[id] + (metric ? 'datasets/' + metric : 'ranges');

        const { data } = await lastValueFrom(this.httpService.get(url));

        return (metric ? data.dataranges : data).map((d) => d.map(fromMins));
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
        const [from, to] = range.map((d) => toMins(d).toString());
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
                response.dataranges.at(-1)?.at(1) ?? toMins(new Date());

            range = [lastDate - durationOrRange, lastDate].map(fromMins) as [
                Date,
                Date
            ];
        }

        // TODO: use maintainer autorecommendation instead
        const variants =
            options?.variants ??
            (await this.recommendVariants(system, metric, range));
        const [from, to] = range.map((d) => toMins(d).toString());

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
            date: fromMins(Number(data[0][0])),
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
