import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSchoolAccountApiKey1000000000040 implements MigrationInterface {
    name = 'AddSchoolAccountApiKey1000000000040';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar account_api_key à tabela schools
        if (!(await queryRunner.hasColumn('schools', 'account_api_key'))) {
            await queryRunner.addColumn('schools', new TableColumn({
                name: 'account_api_key',
                type: 'varchar',
                length: '255',
                isNullable: true,
                default: null
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover account_api_key da tabela schools
        if (await queryRunner.hasColumn('schools', 'account_api_key')) {
            await queryRunner.dropColumn('schools', 'account_api_key');
        }
    }
}

