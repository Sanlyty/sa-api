import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { CatMetricTypeEntity } from './cat-metric-type.entity';

@Entity('metric_thresholds')
export class MetricThresholdEntity {
  @PrimaryGeneratedColumn({ name: 'id_metric_threshold' })
  id: number;

  @ManyToOne(() => CatMetricTypeEntity, type => type.threshold)
  @JoinColumn({ name: 'id_cat_metric_type' })
  metricTypeEntity: CatMetricTypeEntity;

  @Column({ name: 'min_value' })
  minValue: number;

  @Column({ name: 'max_value' })
  maxValue: number;

}
