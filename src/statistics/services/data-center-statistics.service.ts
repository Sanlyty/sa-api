import { Injectable, NotFoundException } from '@nestjs/common';
import {
    DataCenterService,
    MetricGroup,
} from '../../collector/services/data-center.service';
import { StorageEntityMetricTransformer } from '../transformers/storage-entity-metric.transformer';
import { ChaMetricService } from '../../collector/services/cha-metric.service';
import { PoolMetricService } from '../../collector/services/pool-metric.service';
import { MetricEntityInterface } from '../../collector/entities/metric-entity.interface';
import { SystemMetricService } from '../../collector/services/system-metric.service';
import { PeriodType } from '../../collector/enums/period-type.enum';
import { PortMetricService } from '../../collector/services/port-metric.service';
import { StorageMetricEntityHierarchyDto } from '../models/dtos/storage-metric-entity-hierarchy.dto';
import { StatisticParams } from '../controllers/params/statistic.params';

@Injectable()
export class DataCenterStatisticsService {
    constructor(
        private dataCenterService: DataCenterService,
        private chaMetricService: ChaMetricService,
        private portMetricService: PortMetricService,
        private poolMetricService: PoolMetricService,
        private systemMetricService: SystemMetricService
    ) {}

    // TODO do all these parameters as one object
    async getMetricByIdDataCenter(
        metricGroup: MetricGroup,
        idDataCenter: number = null,
        period?: PeriodType,
        statisticParams?: StatisticParams
    ): Promise<StorageMetricEntityHierarchyDto[]> {
        const dataCenterEntity = await this.dataCenterService.getMetricsByGroup(
            metricGroup,
            idDataCenter,
            period,
            statisticParams
        );

        if (!dataCenterEntity) {
            throw new NotFoundException(
                `No data found DataCenter(${idDataCenter})`
            );
        }

        return StorageEntityMetricTransformer.transform(dataCenterEntity);
    }

    public async getAlerts(): Promise<MetricEntityInterface[]> {
        const services = [
            this.chaMetricService,
            this.portMetricService,
            this.poolMetricService,
            this.systemMetricService,
        ];

        return (await Promise.all(services.map((s) => s.getAlerts()))).flat();
    }
}
