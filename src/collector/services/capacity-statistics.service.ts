import { Injectable } from '@nestjs/common';
import { StorageEntityRepository } from '../repositories/storage-entity.repository';
import { StorageEntityEntity } from '../entities/storage-entity.entity';
import { DataCenterService, MetricGroup } from './data-center.service';
import { StatisticParams } from '../../statistics/controllers/params/statistic.params';

@Injectable()
export class CapacityStatisticsService {
    constructor(
        private readonly storageEntityRepository: StorageEntityRepository,
        private readonly datacenterService: DataCenterService
    ) {}

    async getCapacityStatistics(): Promise<StorageEntityEntity[]> {
        const result = await this.datacenterService.getMetricsByGroup(
            MetricGroup.CAPACITY,
            undefined,
            'DAY',
            {} as unknown as StatisticParams
        );

        return result.flatMap((dc) => dc.children);
    }

    async getHostGroupCapacityStatistics(): Promise<StorageEntityEntity[]> {
        const result = await this.datacenterService.getMetricsByGroup(
            MetricGroup.HOST_GROUPS,
            undefined,
            'DAY',
            {} as unknown as StatisticParams
        );

        return result.flatMap((dc) => dc.children);
    }
}
