import { Controller, Get, Query } from '@nestjs/common';

import { CapacityStatisticsService } from '../../collector/services/capacity-statistics.service';
import { DataCenterStatisticsService } from '../services/data-center-statistics.service';
import { GraphDataService } from '../services/graph-data.service';
import { MetricType } from '../../collector/enums/metric-type.enum';
import { Region } from '../models/dtos/region.enum';
import { InfraStatisticsTransformer } from '../transformers/infra-statistics.transformer';
import { PoolAggregatedMetricService } from '../services/pool-aggregated-metric.service';
import { SystemAggregatedMetricService } from '../services/system-aggregated-metric.service';
import { RegionMetricInterface } from '../services/aggregated-metric.service';
import { StorageEntityMetricTransformer } from '../transformers/storage-entity-metric.transformer';
import prisma from '../../prisma';

@Controller('api/v1/infrastructure')
export class InfrastructureStatisticsController {
    constructor(
        private capacityStatisticsService: CapacityStatisticsService,
        private dataCenterService: DataCenterStatisticsService,
        private graphDataService: GraphDataService,
        private poolAggregatedMetricService: PoolAggregatedMetricService,
        private systemAggregatedMetricService: SystemAggregatedMetricService
    ) {}

    @Get('/capacity')
    public async getInfrastructureCapacity() {
        return StorageEntityMetricTransformer.transform(
            await this.capacityStatisticsService.getCapacityStatistics()
        );
    }

    @Get('/host-group-capacity')
    public async getHostGroupCapacity() {
        return StorageEntityMetricTransformer.transform(
            await this.capacityStatisticsService.getHostGroupCapacityStatistics()
        );
    }

    @Get('alerts')
    public async getInfrastructureAlerts() {
        const perfMetrics =
            await this.systemAggregatedMetricService.fetchAggregatedMetricsGrouped(
                [MetricType.WORKLOAD, MetricType.TRANSFER],
                [Region.AMERICA, Region.EUROPE, Region.ASIA]
            );

        const capMetrics =
            await this.poolAggregatedMetricService.fetchAggregatedMetricsGrouped(
                [
                    MetricType.LOGICAL_CAPACITY,
                    MetricType.SUBSCRIBED_CAPACITY,
                    MetricType.TOTAL_SAVING_EFFECT,
                    MetricType.CHANGE_MONTH,
                    MetricType.PHYSICAL_CAPACITY,
                ],
                [Region.AMERICA, Region.EUROPE, Region.ASIA]
            );
        return InfraStatisticsTransformer.transform(
            this.dataCenterService.getAlerts(),
            this.mergeRegionMetrics(perfMetrics, capMetrics, [
                Region.AMERICA,
                Region.EUROPE,
                Region.ASIA,
            ])
        );
    }

    @Get('performance/graph')
    public async getPerformanceGraphData(@Query('types') types: string[]) {
        const result = [];

        for (const type of types) {
            const data = await prisma.timeSeries.findMany({
                select: { x: true, y: true },
                where: { variant: type },
                orderBy: { x: 'asc' },
            });

            result.push({
                type,
                data: data.map(({ x, y }) => ({
                    x: x.toISOString(),
                    y: Math.round(y * 100) / 100,
                })),
            });
        }

        return { data: result };
    }

    @Get('capacity/graph')
    public getCapacityGraphData(@Query('types') types: string[]) {
        return this.getPerformanceGraphData(types);
    }

    mergeRegionMetrics(
        performanceMetrics: RegionMetricInterface[],
        capacityMetrics: RegionMetricInterface[],
        returnedRegions: Region[]
    ): RegionMetricInterface[] {
        return returnedRegions.map((regionVal) => {
            const perf = this.findRegionMetrics(performanceMetrics, regionVal);
            const capMetrics = this.findRegionMetrics(
                capacityMetrics,
                regionVal
            );

            return {
                region: regionVal,
                metrics: [...perf.metrics, ...capMetrics.metrics],
            };
        });
    }

    private findRegionMetrics(
        perfMetrics: RegionMetricInterface[],
        region: Region
    ) {
        const regionData = perfMetrics.find(
            (regionDataMetrics) => regionDataMetrics.region === region
        );

        return regionData ?? { region, metrics: [] };
    }
}
