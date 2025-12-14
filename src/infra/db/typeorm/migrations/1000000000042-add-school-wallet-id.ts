import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSchoolWalletId1000000000042 implements MigrationInterface {
    name = 'AddSchoolWalletId1000000000042';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar wallet_id à tabela schools
        if (!(await queryRunner.hasColumn('schools', 'wallet_id'))) {
            await queryRunner.addColumn('schools', new TableColumn({
                name: 'wallet_id',
                type: 'varchar',
                length: '191',
                isNullable: true,
                default: null
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover wallet_id da tabela schools
        if (await queryRunner.hasColumn('schools', 'wallet_id')) {
            await queryRunner.dropColumn('schools', 'wallet_id');
        }
    }
}

