import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CatMetricTypeEntity } from './cat-metric-type.entity';
import { StorageEntityEntity } from './storage-entity.entity';
import { MetricEntityInterface } from './metric-entity.interface';

@Entity('view_cha_metrics')
export class ChaMetricReadEntity implements MetricEntityInterface {
    @PrimaryColumn()
    id: number;

    @Column()
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
