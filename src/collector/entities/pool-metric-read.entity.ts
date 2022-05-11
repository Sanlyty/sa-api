import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { StorageEntityEntity } from './storage-entity.entity';
import { CatMetricTypeEntity } from './cat-metric-type.entity';
import { MetricEntityInterface } from './metric-entity.interface';

@Entity('view_pool_metrics')
export class PoolMetricReadEntity implements MetricEntityInterface {
    @PrimaryColumn()
    id: number;

    @Column()
    value: number;

    @Column({ name: 'id_cat_metric_type' })
    idType: number;

    @Column()
    date: Date;

    @ManyToOne(() => StorageEntityEntity, (storageEntity) => storageEntity.id, {
        eager: true,
    })
    @JoinColumn({ name: 'id_storage_entity' })
    owner: StorageEntityEntity;

    @ManyToOne(() => CatMetricTypeEntity, { eager: true })
    @JoinColumn({ name: 'id_cat_metric_type' })
    metricTypeEntity: CatMetricTypeEntity;

    metrics: unknown[];
}
