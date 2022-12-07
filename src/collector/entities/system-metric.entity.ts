import { Column, Entity } from 'typeorm';

import { AbstractMetricEntity } from './abstract-metric.entity';

@Entity('system_metrics')
export class SystemMetricEntity extends AbstractMetricEntity {

  @Column({ name: 'peak' })
  peak: number;
}
