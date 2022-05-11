import { Injectable } from '@nestjs/common';
import { SystemMetricService } from '../../collector/services/system-metric.service';
import { GraphDataParams } from '../controllers/params/graph-data.params';
import { PoolMetricService } from '../../collector/services/pool-metric.service';
import { MetricType } from 'dist/src/collector/enums/metric-type.enum';

export enum ServiceType {
    SYSTEM,
    POOL,
}

@Injectable()
export class GraphDataService {
    constructor(
        private readonly systemMetricService: SystemMetricService,
        private readonly poolMetricService: PoolMetricService
    ) {}

    async getGraphData(
        graphFilter: GraphDataParams,
        type: ServiceType
    ): Promise<{ type: MetricType; data: unknown[] }[]> {
        const service = this.resolveService(type);
        return await Promise.all(
            graphFilter.types.map(async (type) => ({
                type,
                data: await service.getMetricGraph(type),
            }))
        );
    }

    private resolveService(type: ServiceType) {
        switch (type) {
            case ServiceType.POOL:
                return this.poolMetricService;
            case ServiceType.SYSTEM:
                return this.systemMetricService;
        }
    }
}
