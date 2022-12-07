import * as fs from 'fs';

import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitDatabase1564589174189 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            fs.readFileSync(__dirname + '/../init.sql').toString()
        );
        await queryRunner.query(
            fs.readFileSync(__dirname + '/../catalogs.sql').toString()
        );
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        return;
    }
}
