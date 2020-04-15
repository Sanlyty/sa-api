import { Column, Entity, PrimaryGeneratedColumn, Tree, TreeChildren, TreeParent } from 'typeorm';

@Entity('storage_entities')
@Tree('closure-table')
export class StorageEntityEntity {
  @PrimaryGeneratedColumn({ name: 'id', type: 'integer' })
  id: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'id_cat_storage_entity_status' })
  idCatComponentStatus: number;

  @Column({name: 'id_cat_storage_entity_type'})
  idType: number;

  @Column({ name: 'serial_number' })
  serialNumber: string;

  @TreeChildren()
  children: StorageEntityEntity[];

  @TreeParent()
  parent: StorageEntityEntity;
}