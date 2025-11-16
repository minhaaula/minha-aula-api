import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddItemsToSubscriptionPlans1000000000031 implements MigrationInterface {
    name = 'AddItemsToSubscriptionPlans1000000000031';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE subscription_plans
            ADD COLUMN items JSON NULL AFTER description
        `);

        // Atualizar plano BASIC com seus itens
        await queryRunner.query(`
            UPDATE subscription_plans
            SET items = JSON_ARRAY(
                'Cadastro de Alunos',
                'Dashboard Gerencial',
                'Relatórios'
            )
            WHERE code = 'BASIC'
        `);

        // Atualizar plano PREMIUM com itens mais completos
        await queryRunner.query(`
            UPDATE subscription_plans
            SET items = JSON_ARRAY(
                'Cadastro de Alunos',
                'Dashboard Gerencial',
                'Relatórios Avançados',
                'Gestão Financeira',
                'Múltiplos Usuários',
                'Suporte Prioritário'
            )
            WHERE code = 'PREMIUM'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE subscription_plans
            DROP COLUMN items
        `);
    }
}

