import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSchoolWithdrawals1000000000037 implements MigrationInterface {
    name = 'CreateSchoolWithdrawals1000000000037';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'school_withdrawals',
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
                        name: 'amount_cents',
                        type: 'int',
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
                        name: 'pix_key',
                        type: 'varchar',
                        length: '191',
                        isNullable: true
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: ['PROCESSING', 'COMPLETED', 'CANCELLED'],
                        default: "'PROCESSING'",
                        isNullable: false
                    },
                    {
                        name: 'processed_at',
                        type: 'datetime',
                        isNullable: true
                    },
                    {
                        name: 'cancelled_at',
                        type: 'datetime',
                        isNullable: true
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
            'school_withdrawals',
            new TableForeignKey({
                columnNames: ['school_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'schools',
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createIndex(
            'school_withdrawals',
            new TableIndex({
                name: 'idx_school_withdrawals_school',
                columnNames: ['school_id']
            })
        );

        await queryRunner.createIndex(
            'school_withdrawals',
            new TableIndex({
                name: 'idx_school_withdrawals_status',
                columnNames: ['status']
            })
        );

        await queryRunner.createIndex(
            'school_withdrawals',
            new TableIndex({
                name: 'idx_school_withdrawals_created',
                columnNames: ['created_at']
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('school_withdrawals', true);
    }
}

