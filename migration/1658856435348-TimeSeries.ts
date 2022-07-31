import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class TimeSeries1658856435348 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'time_series',
                columns: [
                    { name: 'id', isPrimary: true, type: 'int' },
                    {
                        name: 'variant',
                        type: 'varchar',
                        length: '128',
                        isNullable: false,
                    },
                    {
                        name: 'x',
                        type: 'timestamp without time zone',
                        isNullable: false,
                    },
                    { name: 'y', type: 'real', isNullable: false },
                ],
                uniques: [{ columnNames: ['variant', 'x'] }],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('time_series', true);
    }
}
