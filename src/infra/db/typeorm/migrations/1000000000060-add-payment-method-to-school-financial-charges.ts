import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const TABLE_NAME = 'school_financial_charges';

export class AddPaymentMethodToSchoolFinancialCharges1000000000060 implements MigrationInterface {
    name = 'AddPaymentMethodToSchoolFinancialCharges1000000000060';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn(TABLE_NAME, 'payment_method'))) {
            await queryRunner.addColumn(TABLE_NAME, new TableColumn({
                name: 'payment_method',
                type: 'varchar',
                length: '20',
                isNullable: true,
                default: null
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn(TABLE_NAME, 'payment_method')) {
            await queryRunner.dropColumn(TABLE_NAME, 'payment_method');
        }
    }
}
