import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSchoolAccountId1000000000018 implements MigrationInterface {
    name = 'AddSchoolAccountId1000000000018';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn('schools', 'account_id')) {
            return;
        }

        if (await queryRunner.hasColumn('schools', 'asaas_account_id')) {
            await queryRunner.query('ALTER TABLE schools CHANGE `asaas_account_id` `account_id` varchar(191) NULL');
            return;
        }

        await queryRunner.addColumn('schools', new TableColumn({
            name: 'account_id',
            type: 'varchar',
            length: '191',
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn('schools', 'account_id'))) {
            return;
        }

        await queryRunner.dropColumn('schools', 'account_id');
    }
}
