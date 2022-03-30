import { MetricType } from '../../../collector/enums/metric-type.enum';
import { OrderByDirection } from '../sort-storage-entity-by-metric.utils';

export class OrderByVo {
    type: MetricType | string;
    direction: OrderByDirection;
}
