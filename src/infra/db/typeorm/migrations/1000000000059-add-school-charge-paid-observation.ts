import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const TABLE_NAME = 'school_financial_charges';

export class AddSchoolChargePaidObservation1000000000059 implements MigrationInterface {
    name = 'AddSchoolChargePaidObservation1000000000059';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn(TABLE_NAME, 'paid_observation'))) {
            await queryRunner.addColumn(TABLE_NAME, new TableColumn({
                name: 'paid_observation',
                type: 'varchar',
                length: '500',
                isNullable: true,
                default: null
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn(TABLE_NAME, 'paid_observation')) {
            await queryRunner.dropColumn(TABLE_NAME, 'paid_observation');
        }
    }
}
