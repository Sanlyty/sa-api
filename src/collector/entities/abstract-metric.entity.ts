import { Column, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { CatMetricTypeEntity } from './cat-metric-type.entity';
import { StorageEntityEntity } from './storage-entity.entity';

export abstract class AbstractMetricEntity {
  @PrimaryGeneratedColumn({ name: 'id_metric', type: 'integer' })
  id: number;

  @Column({ name: 'value' })
  value: number;

  @Column('date', { name: 'date' })
  date: Date;

  @Column({ name: 'id_cat_metric_type', type: 'integer' })
  idType: number;

  @ManyToOne(() => StorageEntityEntity, storageEntity => storageEntity.id, { eager: true })
  @JoinColumn({ name: 'id_storage_entity' })
  owner: StorageEntityEntity;

  @ManyToOne(() => CatMetricTypeEntity, { eager: true })
  @JoinColumn({ name: 'id_cat_metric_type' })
  metricTypeEntity: CatMetricTypeEntity;
}
