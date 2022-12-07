import { Entity } from 'typeorm';

import { MetricEntityInterface } from './metric-entity.interface';
import { AbstractMetricEntity } from './abstract-metric.entity';

@Entity('cha_metrics')
export class ChaMetricEntity extends AbstractMetricEntity implements MetricEntityInterface {
}
