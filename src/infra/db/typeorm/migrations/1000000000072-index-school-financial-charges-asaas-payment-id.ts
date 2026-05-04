import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Acelera o webhook de pagamento Asaas ao localizar cobranças de aluno por `asaas_payment_id`.
 */
export class indexSchoolFinancialChargesAsaasPaymentId1000000000072 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'CREATE INDEX `idx_school_financial_charges_asaas_payment` ON `school_financial_charges` (`asaas_payment_id`)'
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX `idx_school_financial_charges_asaas_payment` ON `school_financial_charges`');
    }
}
