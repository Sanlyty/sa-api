import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

import { MetricThresholdEntity } from './metric-threshold.entity';

@Entity('cat_metric_type')
export class CatMetricTypeEntity {
  @PrimaryGeneratedColumn({ name: 'id_cat_metric_type', type: 'integer' })
  id: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'unit' })
  unit: string;

  @Column({ name: 'id_cat_metric_group' })
  idCatMetricGroup: number;

  @OneToOne(() => MetricThresholdEntity, threshold => threshold.metricTypeEntity, { eager: true })
  threshold: MetricThresholdEntity;

}
