import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { StorageEntityEntity } from './storage-entity.entity';
import { CatMetricTypeEntity } from './cat-metric-type.entity';
import { MetricEntityInterface } from './metric-entity.interface';

@Entity('view_host_group_metrics')
export class HostGroupMetricReadEntity implements MetricEntityInterface {
    @PrimaryColumn()
    id: number;

    @Column({ name: 'value' })
    value: number;

    @Column('date', { name: 'date' })
    date: Date;

    @Column({ name: 'id_cat_metric_type', type: 'integer' })
    idType: number;

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
