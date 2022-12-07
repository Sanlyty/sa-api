import { Entity } from 'typeorm';

import { MetricEntityInterface } from './metric-entity.interface';
import { AbstractMetricEntity } from './abstract-metric.entity';

@Entity('pool_metrics')
export class PoolMetricEntity extends AbstractMetricEntity implements MetricEntityInterface {
}
