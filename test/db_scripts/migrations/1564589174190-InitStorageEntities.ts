import { MigrationInterface, QueryRunner } from 'typeorm';

import { StorageEntityEntity } from '../../../src/collector/entities/storage-entity.entity';
import { StorageEntityType } from '../../../src/collector/dto/owner.dto';

export class InitStorageEntities1564589174190 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const manager = queryRunner.manager;
        const dc = new StorageEntityEntity();
        dc.name = 'CZ_Chodov';
        dc.idType = StorageEntityType.DATACENTER;
        await manager.save(dc, { transaction: false });

        const system1 = new StorageEntityEntity();
        system1.name = 'XP7_G11_58417';
        system1.idType = StorageEntityType.SYSTEM;
        system1.parent = dc;
        await manager.save(system1, { transaction: false });
        const system2 = new StorageEntityEntity();

        system2.name = 'XP7_G12_58416';
        system2.idType = StorageEntityType.SYSTEM;
        system2.parent = dc;
        await manager.save(system2, { transaction: false });

        const hg = new StorageEntityEntity();
        hg.name = 'czchoct007';
        hg.idType = StorageEntityType.HOST_GROUP;
        hg.parent = system1;
        await manager.save(hg, { transaction: false });

        const cha = new StorageEntityEntity();
        cha.name = 'CHA_1';
        cha.idType = StorageEntityType.ADAPTER_GROUP;
        cha.parent = system1;
        await manager.save(cha, { transaction: false });
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        return;
    }
}
