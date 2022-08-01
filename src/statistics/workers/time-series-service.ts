import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MetricType } from 'src/collector/enums/metric-type.enum';
import { MaintainerService } from 'src/collector/services/maintainer.service';
import prisma from '../../prisma';
import { GraphDataService, ServiceType } from '../services/graph-data.service';
import { TypeMappingUtils } from '../utils/type-mapping.utils';

const FILL_IN_DAYS = 90;

// const toUTCDate = (date: Date) => addDays(date, 0);
const addDays = (date: Date, days: number) =>
    new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + days
        )
    );

@Injectable()
export class TimeSeriesService {
    constructor(
        private graphDataService: GraphDataService,
        private maintainerService: MaintainerService
    ) {
        // Find if TimeSeries has any rows
        // If not, generate historic data

        prisma.timeSeries.count().then(async (count) => {
            if (count === 0) {
                console.log('Creating historic data');
                await this.generateHistoricData();
            }

            await this.generateTimeSeries();
        });
    }

    public async generateHistoricData() {
        // Load data
        const metrics = (
            await Promise.all([
                this.graphDataService.getGraphData(
                    { types: [MetricType.TRANSFER, MetricType.WORKLOAD] },
                    ServiceType.SYSTEM
                ),
                this.graphDataService.getGraphData(
                    {
                        types: [
                            MetricType.SUBSCRIBED_CAPACITY,
                            MetricType.LOGICAL_CAPACITY,
                            MetricType.PHYSICAL_CAPACITY,
                        ],
                    },
                    ServiceType.POOL
                ),
            ])
        ).flatMap((d) => d);

        for (const metric of metrics) {
            if (metric.data.length === 0) continue;

            const metricType = TypeMappingUtils.resolveMetricType(metric.type);

            await prisma.timeSeries.createMany({
                data: metric.data.map(({ date: x, value: y }) => ({
                    x,
                    y,
                    variant: metricType,
                })),
            });
        }
    }

    @Cron('0 0 */6 * * *')
    public async generateTimeSeries() {
        const metrics = [
            MetricType.TRANSFER,
            MetricType.WORKLOAD,
            MetricType.SUBSCRIBED_CAPACITY,
            MetricType.LOGICAL_CAPACITY,
            MetricType.PHYSICAL_CAPACITY,
        ];

        for (const metric of metrics) {
            const variant = TypeMappingUtils.resolveMetricType(metric);

            const existingDates = (
                await prisma.timeSeries.findMany({
                    select: { x: true },
                    where: {
                        variant,
                        x: { gte: addDays(new Date(), -FILL_IN_DAYS) },
                    },
                })
            ).map((d) => d.x.getTime());

            day: for (let i = 0; i < FILL_IN_DAYS; i++) {
                const date = addDays(new Date(), -i);

                if (existingDates.includes(date.getTime())) continue;

                let y = 0;

                for (const system of this.maintainerService.getHandledSystems()) {
                    const response =
                        await this.maintainerService.getMaintainerData(
                            system,
                            variant,
                            [new Date(date), addDays(date, 1)]
                        );

                    if (response.data.length === 0) continue day;

                    response.data[0].slice(1).forEach((v) => {
                        y += v;
                    });
                }

                await prisma.timeSeries.upsert({
                    where: { variant_x: { x: date, variant } },
                    create: { x: date, y, variant },
                    update: { y },
                });
            }
        }
    }
}
