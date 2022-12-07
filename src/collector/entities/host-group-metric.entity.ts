import { Entity } from 'typeorm';

import { AbstractMetricEntity } from './abstract-metric.entity';

@Entity('host_group_metrics')
export class HostGroupMetricEntity extends AbstractMetricEntity {
}
