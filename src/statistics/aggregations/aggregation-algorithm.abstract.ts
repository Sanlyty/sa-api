import { MetricAggregationInterface } from './metric-aggregation.interface';
import { MetricType } from '../../collector/enums/metric-type.enum';
import { MetricEntityInterface } from '../../collector/entities/metric-entity.interface';

export abstract class AggregationAlgorithmAbstract
    implements MetricAggregationInterface
{
    abstract aggregate(
        entities: MetricEntityInterface[][],
        metricType: MetricType,
        options: { weightType: MetricType; ignoreValueUnder: number }
    ): MetricEntityInterface;

    findMetricByType(
        entity: MetricEntityInterface[],
        type: MetricType
    ): MetricEntityInterface | undefined {
        return entity.find(({ metricTypeEntity: { id } }) => id === type);
    }
}
