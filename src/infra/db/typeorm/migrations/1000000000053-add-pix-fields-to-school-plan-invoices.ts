import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPixFieldsToSchoolPlanInvoices1000000000053 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'school_plan_invoices',
            new TableColumn({
                name: 'pix_qr_code',
                type: 'text',
                isNullable: true
            })
        );

        await queryRunner.addColumn(
            'school_plan_invoices',
            new TableColumn({
                name: 'pix_copia_e_cola',
                type: 'text',
                isNullable: true
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('school_plan_invoices', 'pix_copia_e_cola');
        await queryRunner.dropColumn('school_plan_invoices', 'pix_qr_code');
    }
}
