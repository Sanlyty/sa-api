import { MetricType } from '../../collector/enums/metric-type.enum';
import { MetricEntityInterface } from '../../collector/entities/metric-entity.interface';

export interface MetricAggregationInterface {
    aggregate(
        entities: MetricEntityInterface[][],
        metricType: MetricType,
        options: any
    ): MetricEntityInterface;
}
