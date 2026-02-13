import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsPrimaryToSubscriptionPlans1000000000056 implements MigrationInterface {
    name = 'AddIsPrimaryToSubscriptionPlans1000000000056';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE subscription_plans
            ADD COLUMN is_primary TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE subscription_plans
            DROP COLUMN is_primary
        `);
    }
}
