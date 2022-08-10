import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { readFileSync } from 'fs';
import { StorageEntityEntity } from '../entities/storage-entity.entity';
import { lastValueFrom } from 'rxjs';
import { MetricType } from '../enums/metric-type.enum';

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

    public async getMaintainerData(
        id: string,
        metric: string,
        durationOrRange: number | [Date, Date],
        options?: {
            variants?: string[];
        }
    ): Promise<{ variants: string[]; data: [number, ...number[]][] }> {
        if (!this.handlesSystem(id)) {
            return undefined;
        }

        const maintainerUrl = this.maintainerMap[id];

        const dataranges: number[][] = (
            await lastValueFrom(
                this.httpService.get(`${maintainerUrl}datasets/${metric}`)
            )
        ).data.dataranges;

        if (dataranges.length === 0) {
            return {
                variants: [],
                data: [],
            };
        }

        let range;

        if (Array.isArray(durationOrRange)) {
            range = durationOrRange.map((d) => Math.round(Number(d) / 60_000));
        } else {
            const lastDate = dataranges.reverse()[0][1];

            range = [lastDate - durationOrRange, lastDate];
        }

        const variants =
            options?.variants ??
            (
                await lastValueFrom(
                    this.httpService.post(
                        `${maintainerUrl}features/variant_recommend`,
                        {
                            id: metric,
                            from: range[0].toString(),
                            to: range[1].toString(),
                        }
                    )
                )
            ).data;

        const data: [number, ...number[]][] = (
            await lastValueFrom(
                this.httpService.post(
                    `${maintainerUrl}bulkload_json/${metric}`,
                    {
                        variants,
                        from: range[0].toString(),
                        to: range[1].toString(),
                    }
                )
            )
        ).data;

        return {
            variants,
            data,
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
