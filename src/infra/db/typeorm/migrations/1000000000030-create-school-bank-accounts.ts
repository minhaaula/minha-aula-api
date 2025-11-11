import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSchoolBankAccounts1000000000030 implements MigrationInterface {
    name = 'CreateSchoolBankAccounts1000000000030';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'school_bank_accounts',
                columns: [
                    {
                        name: 'id',
                        type: 'char',
                        length: '36',
                        isPrimary: true
                    },
                    {
                        name: 'school_id',
                        type: 'char',
                        length: '36',
                        isNullable: false
                    },
                    {
                        name: 'bank_name',
                        type: 'varchar',
                        length: '191',
                        isNullable: false
                    },
                    {
                        name: 'bank_agency',
                        type: 'varchar',
                        length: '20',
                        isNullable: false
                    },
                    {
                        name: 'bank_account',
                        type: 'varchar',
                        length: '20',
                        isNullable: false
                    },
                    {
                        name: 'bank_account_type',
                        type: 'enum',
                        enum: ['CORRENTE', 'POUPANCA'],
                        isNullable: false
                    },
                    {
                        name: 'bank_account_holder_document',
                        type: 'varchar',
                        length: '14',
                        isNullable: false
                    },
                    {
                        name: 'is_active',
                        type: 'tinyint',
                        width: 1,
                        default: 1,
                        isNullable: false
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        default: 'CURRENT_TIMESTAMP',
                        isNullable: false
                    },
                    {
                        name: 'updated_at',
                        type: 'datetime',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                        isNullable: false
                    }
                ]
            }),
            true
        );

        await queryRunner.createForeignKey(
            'school_bank_accounts',
            new TableForeignKey({
                columnNames: ['school_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'schools',
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createIndex(
            'school_bank_accounts',
            new TableIndex({
                name: 'idx_school_bank_accounts_school',
                columnNames: ['school_id']
            })
        );
        await queryRunner.createIndex(
            'school_bank_accounts',
            new TableIndex({
                name: 'idx_school_bank_accounts_active',
                columnNames: ['is_active']
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('school_bank_accounts', true);
    }
}

