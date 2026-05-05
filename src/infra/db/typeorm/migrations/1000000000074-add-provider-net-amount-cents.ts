import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Adiciona `provider_net_amount_cents` em `school_financial_charges`.
 * Armazena o valor líquido retornado pelo provedor (ex.: Asaas `netValue`) via webhook,
 * sem interferir no `net_amount_cents` (cálculo interno: amount - discount).
 */
export class AddProviderNetAmountCents1000000000074 implements MigrationInterface {
    name = 'AddProviderNetAmountCents1000000000074';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn('school_financial_charges', 'provider_net_amount_cents'))) {
            await queryRunner.addColumn(
                'school_financial_charges',
                new TableColumn({
                    name: 'provider_net_amount_cents',
                    type: 'int',
                    isNullable: true,
                    default: null
                })
            );
        }

        const table = await queryRunner.getTable('school_financial_charges');
        const indexName = 'idx_school_financial_charges_provider_net_amount';
        const hasIndex = table?.indices?.some((idx) => idx.name === indexName);
        if (!hasIndex) {
            await queryRunner.createIndex(
                'school_financial_charges',
                new TableIndex({
                    name: indexName,
                    columnNames: ['provider_net_amount_cents']
                })
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const indexName = 'idx_school_financial_charges_provider_net_amount';
        const table = await queryRunner.getTable('school_financial_charges');
        if (table?.indices?.some((idx) => idx.name === indexName)) {
            await queryRunner.dropIndex('school_financial_charges', indexName);
        }

        if (await queryRunner.hasColumn('school_financial_charges', 'provider_net_amount_cents')) {
            await queryRunner.dropColumn('school_financial_charges', 'provider_net_amount_cents');
        }
    }
}

