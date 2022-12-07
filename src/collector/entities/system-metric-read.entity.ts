import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { StorageEntityEntity } from './storage-entity.entity';
import { MetricEntityInterface } from './metric-entity.interface';
import { CatMetricTypeEntity } from './cat-metric-type.entity';

// TODO move to statistics
// TODO Make a view_metric_active for all "Read" Entity
@Entity('view_system_metrics')
export class SystemMetricReadEntity implements MetricEntityInterface {
    @PrimaryColumn()
    id: number;

    @Column({ name: 'value' })
    value: number;

    @Column({ name: 'peak' })
    peak: number;

    @ManyToOne(() => StorageEntityEntity, (storageEntity) => storageEntity.id, {
        eager: true,
    })
    @JoinColumn({ name: 'id_storage_entity' })
    owner: StorageEntityEntity;

    @Column('date', { name: 'date' })
    date: Date;

    @Column({ name: 'id_cat_metric_type', type: 'integer' })
    idType: number;

    metrics: unknown[];

    @ManyToOne(() => CatMetricTypeEntity, { eager: true })
    @JoinColumn({ name: 'id_cat_metric_type' })
    metricTypeEntity: CatMetricTypeEntity;
}
