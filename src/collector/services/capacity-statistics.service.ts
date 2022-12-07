import { Injectable } from '@nestjs/common';

import { StorageEntityEntity } from '../entities/storage-entity.entity';

import { DataCenterService, MetricGroup } from './data-center.service';

@Injectable()
export class CapacityStatisticsService {
    constructor(private readonly datacenterService: DataCenterService) {}

    async getCapacityStatistics(): Promise<StorageEntityEntity[]> {
        const result = await this.datacenterService.getMetricsByGroup(
            MetricGroup.CAPACITY,
            undefined,
            'DAY',
            null
        );

        return result.flatMap((dc) => dc.children);
    }

    async getHostGroupCapacityStatistics(): Promise<StorageEntityEntity[]> {
        const result = await this.datacenterService.getMetricsByGroup(
            MetricGroup.HOST_GROUPS,
            undefined,
            'DAY',
            null
        );

        return result.flatMap((dc) => dc.children);
    }
}
