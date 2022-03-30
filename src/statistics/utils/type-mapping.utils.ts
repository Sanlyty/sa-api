import { MetricType } from '../../collector/enums/metric-type.enum';
import { SystemMetricType } from '../models/metrics/SystemMetricType';

export class TypeMappingUtils {
    public static resolveMetricType(type: MetricType): SystemMetricType {
        switch (type) {
            case MetricType.TRANSFER:
                return 'TRANSFER';
            case MetricType.WORKLOAD:
                return 'WORKLOAD';
            case MetricType.CHANGE_MONTH:
                return 'CHANGE_MONTH';
            case MetricType.SUBSCRIBED_CAPACITY:
                return 'SUBSCRIBED_CAPACITY';
            case MetricType.PHYSICAL_CAPACITY:
                return 'PHYSICAL_CAPACITY';
            case MetricType.LOGICAL_CAPACITY:
                return 'LOGICAL_CAPACITY';
            case MetricType.TOTAL_SAVING_EFFECT:
                return 'TOTAL_SAVING_EFFECT';
        }
    }
}
