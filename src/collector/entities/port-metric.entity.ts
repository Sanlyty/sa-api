import { Entity } from 'typeorm';

import { MetricEntityInterface } from './metric-entity.interface';
import { AbstractMetricEntity } from './abstract-metric.entity';

@Entity('port_metrics')
export class PortMetricEntity extends AbstractMetricEntity implements MetricEntityInterface {
}
