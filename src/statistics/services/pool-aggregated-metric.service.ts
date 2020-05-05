import { AggregatedMetricService } from './aggregated-metric.service';
import { Injectable } from '@nestjs/common';
import { DataCenterService } from '../../collector/services/data-center.service';
import { MetricTypeService } from '../../collector/services/metric-type.service';
import { MetricType } from '../../collector/enums/metric-type.enum';
import { StorageEntityEntity } from '../../collector/entities/storage-entity.entity';

@Injectable()
export class PoolAggregatedMetricService extends AggregatedMetricService {
  constructor(protected dcService: DataCenterService,
              protected typeService: MetricTypeService) {
    super(dcService, typeService);
  }

  fetchMetricsOnly(entities: StorageEntityEntity[]): any[] {
    const result = [];
    entities.forEach(dataCenter =>
      dataCenter.children.forEach(system =>
        system.children.forEach(pool =>
          result.push(pool.metrics),
        ),
      ),
    );
    return result;
  }

  getData(types: MetricType[], dataCenterIds: number[]): Promise<StorageEntityEntity[]> {
    return this.dcService.getPoolMetrics(types, dataCenterIds);
  }
}
