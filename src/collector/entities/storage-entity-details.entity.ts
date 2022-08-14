import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('storage_entity_details')
export class StorageEntityDetailsEntity {
    @PrimaryColumn({ name: 'id_storage_entity', type: 'integer' })
    id: number;
    @Column({ name: 'model' })
    model: string;
    @Column({ name: 'dkc' })
    dkc: string;
    @Column({ name: 'management_ip' })
    managementIp: string;
    @Column({ name: 'rack' })
    rack: string;
    @Column({ name: 'room' })
    room: string;
    @Column({ name: 'prefix_reference_id' })
    prefixReferenceId: string;
    @Column({ name: 'sort_id' })
    sortId: number;
    @Column({ name: 'speed' })
    speed: number;
    @Column({ name: 'note' })
    note: string;
    @Column({ name: 'cables' })
    cables: string;
    @Column({ name: 'switch' })
    switch: string;
    @Column({ name: 'slot' })
    slot: string;
    @Column({ name: 'wwn' })
    wwn: string;

    @Column({ name: 'automation' })
    automation: boolean;
    @Column({ name: 'covers' })
    covers: string;
    @Column({ name: 'throughput' })
    throughput: number;
}
