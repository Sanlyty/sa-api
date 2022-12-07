import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { StorageEntityEntity } from './storage-entity.entity';
import { CatMetricTypeEntity } from './cat-metric-type.entity';

@Entity('parity_group_metrics')
export class ParityGroupMetricEntity {
  @PrimaryGeneratedColumn({ name: 'id_metric', type: 'integer' })
  id: number;

  @Column({ name: 'value' })
  value: number;

  @Column({ name: 'peak' })
  peak: number;

  @Column('timestamp without time zone', { name: 'start_time' })
  startTime: Date;

  @Column('timestamp without time zone', { name: 'end_time' })
  endTime: Date;

  @Column({ name: 'id_cat_metric_type', type: 'integer' })
  idType: number;

  @ManyToOne(() => StorageEntityEntity, storageEntity => storageEntity.id, { eager: true })
  @JoinColumn({ name: 'id_storage_entity' })
  owner: StorageEntityEntity;

  @ManyToOne(() => CatMetricTypeEntity, { eager: true })
  @JoinColumn({ name: 'id_cat_metric_type' })
  metricTypeEntity: CatMetricTypeEntity;
}