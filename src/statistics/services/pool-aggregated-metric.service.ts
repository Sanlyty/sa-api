import { Injectable } from '@nestjs/common';

import {
    DataCenterService,
    MetricGroup,
} from '../../collector/services/data-center.service';
import { MetricTypeService } from '../../collector/services/metric-type.service';
import { MetricType } from '../../collector/enums/metric-type.enum';
import { StorageEntityEntity } from '../../collector/entities/storage-entity.entity';
import { MetricEntityInterface } from '../../collector/entities/metric-entity.interface';

import { AggregatedMetricService } from './aggregated-metric.service';

@Injectable()
export class PoolAggregatedMetricService extends AggregatedMetricService {
    constructor(
        protected dcService: DataCenterService,
        protected typeService: MetricTypeService
    ) {
        super(dcService, typeService);
    }

    fetchMetricsOnly(
        entities: StorageEntityEntity[]
    ): MetricEntityInterface[][] {
        return entities.flatMap((dataCenter) =>
            dataCenter.children.flatMap((system) =>
                system.children.map((pool) => pool.metrics)
            )
        );
    }

    getData(
        types: MetricType[],
        dataCenterIds: number[]
    ): Promise<StorageEntityEntity[]> {
        return this.dcService.getPoolMetrics(
            types,
            dataCenterIds,
            MetricGroup.CAPACITY,
            'DAY'
        );
    }
}
