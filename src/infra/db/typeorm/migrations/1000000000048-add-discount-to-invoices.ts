import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDiscountToInvoices1000000000048 implements MigrationInterface {
    name = 'AddDiscountToInvoices1000000000048';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('school_plan_invoices');
        if (table) {
            const columnsToAdd = [
                new TableColumn({
                    name: 'discount_coupon_id',
                    type: 'char',
                    length: '36',
                    isNullable: true
                }),
                new TableColumn({
                    name: 'discount_percentage',
                    type: 'decimal',
                    precision: 5,
                    scale: 2,
                    isNullable: true
                }),
                new TableColumn({
                    name: 'discount_amount_cents',
                    type: 'int',
                    default: 0
                }),
                new TableColumn({
                    name: 'original_amount_cents',
                    type: 'int',
                    isNullable: false
                })
            ];

            for (const column of columnsToAdd) {
                if (!(await queryRunner.hasColumn('school_plan_invoices', column.name))) {
                    await queryRunner.addColumn('school_plan_invoices', column);
                }
            }

            // Se original_amount_cents não existir, copiar de amount_cents
            if (await queryRunner.hasColumn('school_plan_invoices', 'original_amount_cents')) {
                await queryRunner.query(`
                    UPDATE school_plan_invoices 
                    SET original_amount_cents = amount_cents 
                    WHERE original_amount_cents IS NULL OR original_amount_cents = 0
                `);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('school_plan_invoices');
        if (table) {
            const columnsToDrop = [
                'discount_coupon_id',
                'discount_percentage',
                'discount_amount_cents',
                'original_amount_cents'
            ];

            for (const columnName of columnsToDrop) {
                if (await queryRunner.hasColumn('school_plan_invoices', columnName)) {
                    await queryRunner.dropColumn('school_plan_invoices', columnName);
                }
            }
        }
    }
}

