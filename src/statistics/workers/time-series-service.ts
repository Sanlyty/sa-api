import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MetricType } from '../../collector/enums/metric-type.enum';
import { MaintainerService } from '../../collector/services/maintainer.service';
import prisma from '../../prisma';
import { GraphDataService, ServiceType } from '../services/graph-data.service';
import { TypeMappingUtils } from '../utils/type-mapping.utils';

const FILL_IN_DAYS = 90;

const addDays = (date: Date, days: number) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// const isSameDay = (a: Date, b: Date) =>
//     a.getFullYear() === b.getFullYear() &&
//     a.getMonth() === b.getMonth() &&
//     a.getDate() === b.getDate();

const toDateString = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

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
                data: metric.data.map(({ date, value: y }) => ({
                    x: toDateString(date),
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

        const systems = [];

        for (const system of this.maintainerService.getHandledSystems()) {
            if (!(await this.maintainerService.getStatus(system))) {
                console.warn(
                    `Skipping time series sum for ${system} as it is not available`
                );
            } else {
                systems.push(system);
            }
        }

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
            ).map((d) => toDateString(d.x));

            day: for (let i = 0; i < FILL_IN_DAYS; i++) {
                const date = addDays(new Date(), -i);

                if (existingDates.includes(toDateString(date))) continue;

                let y = 0;

                for (const system of systems) {
                    const response =
                        await this.maintainerService.getMaintainerData(
                            system,
                            variant,
                            [new Date(date), addDays(date, 1)]
                        );

                    if (response.data.length === 0) continue day;

                    if (variant === 'WORKLOAD' || variant === 'TRANSFER') {
                        y +=
                            response.data[0][
                                1 + response.variants.indexOf('average')
                            ];
                    } else {
                        response.data[0].slice(1).forEach((v) => {
                            y += v;
                        });
                    }
                }

                const x = toDateString(date);
                await prisma.timeSeries.upsert({
                    where: { variant_x: { x, variant } },
                    create: { x, y, variant },
                    update: { y },
                });
            }
        }
    }
}
