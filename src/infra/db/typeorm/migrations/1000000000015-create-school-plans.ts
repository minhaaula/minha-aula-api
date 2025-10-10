import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchoolPlans1000000000015 implements MigrationInterface {
    name = 'CreateSchoolPlans1000000000015';

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id CHAR(36) PRIMARY KEY,
                code VARCHAR(32) NOT NULL UNIQUE,
                name VARCHAR(191) NOT NULL,
                description VARCHAR(255) NULL,
                amount_cents INT NOT NULL,
                currency CHAR(3) NOT NULL DEFAULT 'BRL',
                billing_cycle ENUM('MONTHLY', 'ANNUAL') NOT NULL DEFAULT 'MONTHLY',
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        await q.query(`
            CREATE TABLE IF NOT EXISTS school_plan_finances (
                id CHAR(36) PRIMARY KEY,
                school_id CHAR(36) NOT NULL,
                plan_id CHAR(36) NOT NULL,
                status ENUM('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
                is_paid TINYINT(1) NOT NULL DEFAULT 0,
                last_payment_at DATETIME NULL,
                next_due_at DATETIME NULL,
                notes VARCHAR(255) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_school_plan_finances_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
                CONSTRAINT fk_school_plan_finances_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT,
                CONSTRAINT uq_school_plan_finances_school UNIQUE (school_id)
            ) ENGINE=InnoDB;
        `);
        await q.query('CREATE INDEX idx_school_plan_finances_plan ON school_plan_finances(plan_id);');
        await q.query('CREATE INDEX idx_school_plan_finances_due ON school_plan_finances(next_due_at);');

        await q.query(`
            INSERT INTO subscription_plans (id, code, name, description, amount_cents, currency)
            SELECT '3a9ac6f2-bbfc-49f2-8ebf-52a8ce28b5c9', 'BASIC', 'Plano Básico', 'Plano mensal básico para escolas', 15000, 'BRL'
            WHERE NOT EXISTS (
                SELECT 1 FROM subscription_plans WHERE code = 'BASIC'
            );
        `);

        await q.query(`
            INSERT INTO subscription_plans (id, code, name, description, amount_cents, currency)
            SELECT '83b7d2f3-47dd-45be-9b1d-23a61d873c12', 'PREMIUM', 'Plano Premium', 'Plano mensal avançado para escolas', 22000, 'BRL'
            WHERE NOT EXISTS (
                SELECT 1 FROM subscription_plans WHERE code = 'PREMIUM'
            );
        `);
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query('DROP TABLE IF EXISTS school_plan_finances;');
        await q.query('DROP TABLE IF EXISTS subscription_plans;');
    }
}
