import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Adiciona campos necessários para a integração Asaas em produção (white-label):
 *
 * - schools.account_status_snapshot (JSON): último snapshot do status cadastral da subconta
 *   recebido via webhook (commercialInfo, bankAccountInfo, documentation, general). Permite
 *   exibir à escola a etapa atual do KYC sem chamadas extras à API do Asaas.
 * - school_withdrawals.provider_ref: id da transferência no Asaas, usado pelo webhook
 *   /integrations/asaas/transfers para localizar e atualizar o saque.
 * - school_withdrawals.failure_reason: motivo retornado pelo Asaas quando a transferência
 *   é cancelada/recusada (TRANSFER_FAILED / TRANSFER_BLOCKED).
 * - Índice em schools(account_id): usado por findByAccountId quando o webhook do Asaas
 *   só envia o id da conta (sem externalReference).
 * - Índice em school_withdrawals(provider_ref): lookup por providerRef no webhook.
 */
export class AsaasProductionFields1000000000069 implements MigrationInterface {
    name = 'AsaasProductionFields1000000000069';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn('schools', 'account_status_snapshot'))) {
            await queryRunner.addColumn('schools', new TableColumn({
                name: 'account_status_snapshot',
                type: 'json',
                isNullable: true,
                default: null
            }));
        }

        if (!(await queryRunner.hasColumn('school_withdrawals', 'provider_ref'))) {
            await queryRunner.addColumn('school_withdrawals', new TableColumn({
                name: 'provider_ref',
                type: 'varchar',
                length: '191',
                isNullable: true,
                default: null
            }));
        }

        if (!(await queryRunner.hasColumn('school_withdrawals', 'failure_reason'))) {
            await queryRunner.addColumn('school_withdrawals', new TableColumn({
                name: 'failure_reason',
                type: 'varchar',
                length: '500',
                isNullable: true,
                default: null
            }));
        }

        const schoolsTable = await queryRunner.getTable('schools');
        const accountIdIndexExists = schoolsTable?.indices?.some((idx) => idx.name === 'idx_schools_account_id');
        if (!accountIdIndexExists) {
            await queryRunner.createIndex('schools', new TableIndex({
                name: 'idx_schools_account_id',
                columnNames: ['account_id']
            }));
        }

        const withdrawalsTable = await queryRunner.getTable('school_withdrawals');
        const providerRefIndexExists = withdrawalsTable?.indices?.some((idx) => idx.name === 'idx_school_withdrawals_provider_ref');
        if (!providerRefIndexExists) {
            await queryRunner.createIndex('school_withdrawals', new TableIndex({
                name: 'idx_school_withdrawals_provider_ref',
                columnNames: ['provider_ref']
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const withdrawalsTable = await queryRunner.getTable('school_withdrawals');
        if (withdrawalsTable?.indices?.some((idx) => idx.name === 'idx_school_withdrawals_provider_ref')) {
            await queryRunner.dropIndex('school_withdrawals', 'idx_school_withdrawals_provider_ref');
        }

        const schoolsTable = await queryRunner.getTable('schools');
        if (schoolsTable?.indices?.some((idx) => idx.name === 'idx_schools_account_id')) {
            await queryRunner.dropIndex('schools', 'idx_schools_account_id');
        }

        if (await queryRunner.hasColumn('school_withdrawals', 'failure_reason')) {
            await queryRunner.dropColumn('school_withdrawals', 'failure_reason');
        }

        if (await queryRunner.hasColumn('school_withdrawals', 'provider_ref')) {
            await queryRunner.dropColumn('school_withdrawals', 'provider_ref');
        }

        if (await queryRunner.hasColumn('schools', 'account_status_snapshot')) {
            await queryRunner.dropColumn('schools', 'account_status_snapshot');
        }
    }
}
