import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE_NAME = 'school_financial_charges';

export class CreateSchoolFinancialCharges1000000000024 implements MigrationInterface {
    name = 'CreateSchoolFinancialCharges1000000000024';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE ${TABLE_NAME} (
                id CHAR(36) NOT NULL,
                school_id CHAR(36) NOT NULL,
                owner_user_id CHAR(36) NOT NULL,
                student_user_id CHAR(36) NULL,
                dependent_id CHAR(36) NULL,
                course_id CHAR(36) NOT NULL,
                course_class_id CHAR(36) NULL,
                charge_type ENUM('TUITION','ENROLLMENT','MATERIALS','DAILY','OTHER') NOT NULL,
                description VARCHAR(255) NULL,
                amount_cents INT NOT NULL,
                discount_cents INT NULL,
                discount_reason VARCHAR(255) NULL,
                net_amount_cents INT NOT NULL,
                due_date DATE NOT NULL,
                status ENUM('PENDING_SYNC','OPEN','PAID','OVERDUE','CANCELLED','FAILED') NOT NULL DEFAULT 'PENDING_SYNC',
                asaas_payment_id VARCHAR(191) NULL,
                asaas_invoice_url VARCHAR(512) NULL,
                asaas_payload JSON NULL,
                paid_at DATETIME NULL,
                cancelled_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                CONSTRAINT fk_${TABLE_NAME}_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
                CONSTRAINT fk_${TABLE_NAME}_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_${TABLE_NAME}_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_${TABLE_NAME}_dependent FOREIGN KEY (dependent_id) REFERENCES dependents(id) ON DELETE SET NULL,
                CONSTRAINT fk_${TABLE_NAME}_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                CONSTRAINT fk_${TABLE_NAME}_course_class FOREIGN KEY (course_class_id) REFERENCES course_classes(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await queryRunner.query(`CREATE INDEX idx_${TABLE_NAME}_school ON ${TABLE_NAME} (school_id);`);
        await queryRunner.query(`CREATE INDEX idx_${TABLE_NAME}_status ON ${TABLE_NAME} (status);`);
        await queryRunner.query(`CREATE INDEX idx_${TABLE_NAME}_due_date ON ${TABLE_NAME} (due_date);`);
        await queryRunner.query(`CREATE INDEX idx_${TABLE_NAME}_student ON ${TABLE_NAME} (student_user_id);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX idx_${TABLE_NAME}_student ON ${TABLE_NAME};`);
        await queryRunner.query(`DROP INDEX idx_${TABLE_NAME}_due_date ON ${TABLE_NAME};`);
        await queryRunner.query(`DROP INDEX idx_${TABLE_NAME}_status ON ${TABLE_NAME};`);
        await queryRunner.query(`DROP INDEX idx_${TABLE_NAME}_school ON ${TABLE_NAME};`);
        await queryRunner.query(`DROP TABLE ${TABLE_NAME};`);
    }
}
