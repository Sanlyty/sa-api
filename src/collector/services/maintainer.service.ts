import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { readFileSync } from 'fs';
import { StorageEntityEntity } from '../entities/storage-entity.entity';
import { MetricEntityInterface } from '../entities/metric-entity.interface';
import { lastValueFrom } from 'rxjs';

const metricNameMap: Record<string, string> = {
    RESPONSE: 'RESPONSE_READ_DAY',
    RESPONSE_DAY: 'RESPONSE_READ_DAY',
    RESPONSE_WEEK: 'RESPONSE_READ_WEEK',
    RESPONSE_MONTH: 'RESPONSE_READ_MONTH',

    CHANGE_DAY: 'PHYSICAL_CAPACITY_DAY',
    CHANGE_WEEK: 'PHYSICAL_CAPACITY_WEEK',
    CHANGE_MONTH: 'PHYSICAL_CAPACITY_MONTH',

    PHYSICAL_FREE: 'AVAILABLE_CAPACITY',

    // TODO: figure out these
    VMW_CHANGE_DAY: 'VMW_NET_USED_DAY',
    VMW_CHANGE_WEEK: 'VMW_NET_USED_WEEK',
    VMW_CHANGE_MONTH: 'VMW_NET_USED_MONTH',

    // TODO:
    SLA_EVENTS_DAY: 'SLA_EVENTS',
    SLA_EVENTS_WEEK: 'SLA_EVENTS',
    SLA_EVENTS_MONTH: 'SLA_EVENTS',
    OUT_OF_SLA_TIME: 'OUT_OF_SLA_TIME_DAY',

    // Imbalances
    IMBALANCE_ABSOLUT: 'CHANNEL_IMBALANCES',
    IMBALANCE_ABSOLUT_WEEK: 'CHANNEL_IMBALANCES_WEEK',
    IMBALANCE_ABSOLUT_MONTH: 'CHANNEL_IMBALANCES_MONTH',

    IMBALANCE_PERC: 'CHANNEL_IMBALANCES_PERC',
    IMBALANCE_PERC_WEEK: 'CHANNEL_IMBALANCES_PERC_WEEK',
    IMBALANCE_PERC_MONTH: 'CHANNEL_IMBALANCES_PERC_MONTH',

    IMBALANCE_EVENTS: 'CHANNEL_IMBALANCES_COUNT',
    IMBALANCE_EVENTS_WEEK: 'CHANNEL_IMBALANCES_COUNT_WEEK',
    IMBALANCE_EVENTS_MONTH: 'CHANNEL_IMBALANCES_COUNT_MONTH',

    PORT_IMBALANCE_ABSOLUT: 'PORT_IMBALANCES',
    PORT_IMBALANCE_ABSOLUT_WEEK: 'PORT_IMBALANCES_WEEK',
    PORT_IMBALANCE_ABSOLUT_MONTH: 'PORT_IMBALANCES_MONTH',

    PORT_IMBALANCE_PERC: 'PORT_IMBALANCES_PERC',
    PORT_IMBALANCE_PERC_WEEK: 'PORT_IMBALANCES_PERC_WEEK',
    PORT_IMBALANCE_PERC_MONTH: 'PORT_IMBALANCES_PERC_MONTH',

    PORT_IMBALANCE_EVENTS: 'PORT_IMBALANCES_COUNT',
    PORT_IMBALANCE_EVENTS_WEEK: 'PORT_IMBALANCES_COUNT_WEEK',
    PORT_IMBALANCE_EVENTS_MONTH: 'PORT_IMBALANCES_COUNT_MONTH',
};

@Injectable()
export class MaintainerService {
    private maintainerMap: Record<string, string> = {};

    constructor(private httpService: HttpService) {
        this.maintainerMap = process.env.CONF_MAINTAINER_MAP
            ? JSON.parse(
                  readFileSync(`${process.env.CONF_MAINTAINER_MAP}`, {
                      encoding: 'utf8',
                  })
              )
            : {};
    }

    public handlesSystem(id: string): boolean {
        return id in this.maintainerMap;
    }

    public getHandledSystems(): string[] {
        return Object.keys(this.maintainerMap);
    }

    public async getLatencyAnalysisDates(systemId: string): Promise<string[]> {
        const maintainerUrl = this.maintainerMap[systemId];

        return (
            await lastValueFrom(this.httpService
                .post(`${maintainerUrl}features/latency_analysis_dates`))
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
            await lastValueFrom(this.httpService
                .post(`${maintainerUrl}features/latency_analysis`, {
                    op,
                    dates,
                    pool: poolName,
                }))
        ).data;
    }

    public async getPGEvents(
        systemId: string,
        from?: number,
        to?: number
    ): Promise<
        {
            from: number;
            to: number;
            average: number;
            peak: number;
            key: string;
        }[]
    > {
        const maintainerUrl = this.maintainerMap[systemId];

        return (
            await lastValueFrom(this.httpService
                .post(`${maintainerUrl}features/pg_events`, {
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
        options?: {
            additionalKeys?: Record<string, MetricColSelector>;
            metrics?: {
                id: string;
                target?: string;
                unit: string;
            }[];
            metricNameTransform?: (m: string) => string;
            skipMetric?: (m: MetricEntityInterface) => boolean;
        }
    ) {
        const metricData: Record<
            string,
            { data: LastMaintainerData; target?: string; unit: string }
        > = {};

        if (options?.metrics) {
            // Preset metrics

            for (const metric of options.metrics) {
                metricData[metric.id] = {
                    data: await this.getLastMaintainerData(systemId, metric.id),
                    target: metric.target,
                    unit: metric.unit,
                };
            }
        } else {
            // Autodetect metrics

            const known: Set<string> = new Set();
            await Promise.all(
                entities.flatMap((e) =>
                    e.metrics.map(async (m) => {
                        if (options?.skipMetric && options.skipMetric(m)) {
                            return;
                        }

                        const metricName = m.metricTypeEntity.name;

                        // ? Why not check for key in 'metricData'
                        // A The assignment is after an await point -> redundant calls
                        if (!known.has(metricName)) {
                            known.add(metricName);
                            metricData[metricName] = {
                                data: await this.getLastMaintainerData(
                                    systemId,
                                    options?.metricNameTransform
                                        ? options.metricNameTransform(
                                              metricName
                                          )
                                        : metricName
                                ),
                                unit: m.metricTypeEntity.unit,
                            };
                        }
                    })
                )
            );
        }

        entities.forEach((e) => {
            // Retain skipped metrics
            e.metrics =
                e.metrics?.filter(
                    (m) => options?.skipMetric && options.skipMetric(m)
                ) ?? [];

            //  Fill in obtained metrics
            e.metrics.push(
                ...Object.keys(metricData).map((metricId) => {
                    const mData = metricData[metricId];

                    const result = {
                        id: -1,
                        metricTypeEntity: {
                            id: -1,
                            name: mData.target ?? metricId,
                            unit: mData.unit,
                            threshold: undefined as any,
                            idCatMetricGroup: undefined as any,
                        },
                        date: mData.data.date,
                        value:
                            mData.data.cols[dataKeySelector(e, metricId)] ?? 0,
                    };

                    // Assign additional keys other than 'value'
                    for (const additional in options?.additionalKeys) {
                        result[additional] =
                            mData.data.cols[
                                options.additionalKeys[additional](e, metricId)
                            ] ?? 0;
                    }

                    return result;
                })
            );
        });
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

        const maintainerUrl = this.maintainerMap[id];
        metric = metricNameMap[metric] ?? metric;

        // console.log(metric);
        const dataranges: number[][] = (
            await lastValueFrom(this.httpService
                .get(`${maintainerUrl}datasets/${metric}`)
            )
        ).data.dataranges;

        if (dataranges.length === 0) {
            return {
                date: new Date(),
                cols: {},
            };
        }

        const lastDate = dataranges.reverse()[0][1];

        const variants =
            options?.variants ??
            (
                await lastValueFrom(this.httpService
                    .post(`${maintainerUrl}features/variant_recommend`, {
                        id: metric,
                        from: (lastDate - 1).toString(),
                        to: lastDate.toString(),
                    })
                )
            ).data;

        // console.log(variants);

        const data: number[][] = (
            await lastValueFrom(this.httpService
                .post(`${maintainerUrl}bulkload_json/${metric}`, {
                    variants,
                    from: (lastDate - 1).toString(),
                    to: lastDate.toString(),
                })
            )
        ).data;

        return {
            date: new Date(data[0][0] * 60_000),
            cols: variants.reduce((prev, next, i) => {
                prev[next] = data[0][i + 1];
                return prev;
            }, {}),
        };
    }
}

type LastMaintainerData = {
    date: Date;
    cols: Record<string, number>;
};

type MetricColSelector = (e: StorageEntityEntity, metricName: string) => string;
