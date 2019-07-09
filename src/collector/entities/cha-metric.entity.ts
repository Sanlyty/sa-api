import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MetricTypeTransformer } from '../transformers/metric-type.transformer';
import { MetricType } from '../enums/metric-type.enum';
import { CatMetricTypeEntity } from './cat-metric-type.entity';
import { ChaEntity } from './cha.entity';

@Entity('cha_metrics')
export class ChaMetricEntity {

  @PrimaryGeneratedColumn({ name: 'id_cha_metric' })
  id: number;

  @Column({ name: 'id_cha' })
  idCha: number;

  @Column({ name: 'value', length: 100 })
  value: string;

  @Column({ name: 'id_system' })
  idSystem: number;

  @Column('date', { name: 'date' })
  date: Date;

  @Column({ name: 'id_cat_metric_type', transformer: MetricTypeTransformer })
  metricType: MetricType;

  @ManyToOne(type => CatMetricTypeEntity)
  @JoinColumn({ name: 'id_cat_metric_type' })
  metricTypeEntity: CatMetricTypeEntity;

  @ManyToOne(type => ChaEntity)
  @JoinColumn({ name: 'id_cha' })
  adapter: ChaEntity;
}
