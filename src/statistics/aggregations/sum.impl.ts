import { MetricType } from '../../collector/enums/metric-type.enum';
import { MetricEntityInterface } from '../../collector/entities/metric-entity.interface';
import { AggregationAlgorithmAbstract } from './aggregation-algorithm.abstract';

export class SumImpl extends AggregationAlgorithmAbstract {
  constructor() {
    super();
  }

  aggregate(entities: MetricEntityInterface[][], metricType: MetricType, options: any): MetricEntityInterface {
    let aggValueTotal = 0;
    entities.forEach(
      entity => {
        const metric = this.findMetricByType(entity, metricType);
        if (metric !== undefined) {
          aggValueTotal += metric.value;
        }
      },
    );
    return { value: aggValueTotal, metricTypeEntity: null, id: null, date: null };
  }

}
