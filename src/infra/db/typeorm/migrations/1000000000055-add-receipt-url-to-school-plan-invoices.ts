import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddReceiptUrlToSchoolPlanInvoices1000000000055 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'school_plan_invoices',
            new TableColumn({
                name: 'receipt_url',
                type: 'varchar',
                length: '500',
                isNullable: true
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('school_plan_invoices', 'receipt_url');
    }
}
