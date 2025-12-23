import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class CreateDiscountCoupons1000000000047 implements MigrationInterface {
    name = 'CreateDiscountCoupons1000000000047';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'discount_coupons',
                columns: [
                    {
                        name: 'id',
                        type: 'char',
                        length: '36',
                        isPrimary: true
                    },
                    {
                        name: 'code',
                        type: 'varchar',
                        length: '50',
                        isUnique: true,
                        isNullable: false
                    },
                    {
                        name: 'percentage',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: 'valid_until',
                        type: 'date',
                        isNullable: false
                    },
                    {
                        name: 'duration_months',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'is_active',
                        type: 'tinyint',
                        width: 1,
                        default: 1
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'deleted_at',
                        type: 'datetime',
                        isNullable: true
                    }
                ]
            }),
            true
        );

        await queryRunner.createIndex(
            'discount_coupons',
            new TableIndex({
                name: 'idx_discount_coupons_code',
                columnNames: ['code'],
                isUnique: true
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('discount_coupons');
        if (table) {
            const index = table.indices.find(idx => idx.name === 'idx_discount_coupons_code');
            if (index) {
                await queryRunner.dropIndex('discount_coupons', index);
            }
        }
        await queryRunner.dropTable('discount_coupons');
    }
}

