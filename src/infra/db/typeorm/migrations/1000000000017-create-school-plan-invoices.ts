import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchoolPlanInvoices1000000000017 implements MigrationInterface {
    name = 'CreateSchoolPlanInvoices1000000000017';

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE IF NOT EXISTS school_plan_invoices (
                id CHAR(36) PRIMARY KEY,
                finance_id CHAR(36) NOT NULL,
                school_id CHAR(36) NOT NULL,
                plan_id CHAR(36) NOT NULL,
                amount_cents INT NOT NULL,
                currency CHAR(3) NOT NULL,
                status ENUM('ISSUED','PAID','FAILED','CANCELLED') NOT NULL DEFAULT 'ISSUED',
                due_date DATE NOT NULL,
                paid_at DATETIME NULL,
                description VARCHAR(255) NULL,
                provider_ref VARCHAR(191) NULL,
                boleto_url VARCHAR(255) NULL,
                digitable_line VARCHAR(255) NULL,
                barcode VARCHAR(255) NULL,
                external_reference VARCHAR(255) NULL,
                metadata JSON NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_school_plan_invoices_finance FOREIGN KEY (finance_id) REFERENCES school_plan_finances(id) ON DELETE CASCADE,
                CONSTRAINT fk_school_plan_invoices_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
                CONSTRAINT fk_school_plan_invoices_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT,
                CONSTRAINT uq_school_plan_invoices_finance_due UNIQUE (finance_id, due_date)
            ) ENGINE=InnoDB;
        `);

        await q.query('CREATE INDEX idx_school_plan_invoices_school ON school_plan_invoices(school_id);');
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query('DROP TABLE IF EXISTS school_plan_invoices;');
    }
}
