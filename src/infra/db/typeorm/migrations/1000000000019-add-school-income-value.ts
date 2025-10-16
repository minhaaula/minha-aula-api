import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSchoolIncomeValue1000000000019 implements MigrationInterface {
    name = 'AddSchoolIncomeValue1000000000019';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn('schools', 'income_value')) {
            return;
        }

        await queryRunner.addColumn('schools', new TableColumn({
            name: 'income_value',
            type: 'int',
            isNullable: false,
            default: 5000
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn('schools', 'income_value'))) {
            return;
        }

        await queryRunner.dropColumn('schools', 'income_value');
    }
}
