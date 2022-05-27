import { AggregatedMetricService } from './aggregated-metric.service';
import {
    DataCenterService,
    MetricGroup,
} from '../../collector/services/data-center.service';
import { MetricTypeService } from '../../collector/services/metric-type.service';
import { MetricType } from '../../collector/enums/metric-type.enum';
import { Injectable } from '@nestjs/common';
import { StorageEntityEntity } from '../../collector/entities/storage-entity.entity';

@Injectable()
export class SystemAggregatedMetricService extends AggregatedMetricService {
    constructor(
        protected dcService: DataCenterService,
        protected typeService: MetricTypeService
    ) {
        super(dcService, typeService);
    }

    getData(
        types: MetricType[],
        dataCenterIds: number[]
    ): Promise<StorageEntityEntity[]> {
        return this.dcService.getPerformanceMetrics(
            types,
            dataCenterIds,
            MetricGroup.PERFORMANCE,
            'DAY'
        );
    }

    fetchMetricsOnly(entities: StorageEntityEntity[]) {
        return entities.flatMap((dataCenter) =>
            dataCenter.children.map((system) => system.metrics)
        );
    }
}
