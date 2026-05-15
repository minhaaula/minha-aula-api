import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnrollmentLevelsCertificatesTimeline1000000000075 implements MigrationInterface {
    name = 'EnrollmentLevelsCertificatesTimeline1000000000075';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE school_student_levels (
                id CHAR(36) NOT NULL PRIMARY KEY,
                school_id CHAR(36) NOT NULL,
                label VARCHAR(191) NOT NULL,
                template_code VARCHAR(64) NULL,
                sort_order INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_school_student_levels_school_sort (school_id, sort_order),
                UNIQUE KEY uq_school_student_levels_school_code (school_id, template_code),
                CONSTRAINT fk_school_student_levels_school
                    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await queryRunner.query(`
            CREATE TABLE school_certificate_templates (
                id CHAR(36) NOT NULL PRIMARY KEY,
                school_id CHAR(36) NOT NULL,
                name VARCHAR(191) NOT NULL,
                logical_template_id VARCHAR(64) NOT NULL,
                layout_config JSON NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_school_certificate_templates_school (school_id),
                UNIQUE KEY uq_school_certificate_templates_school_logical_id (school_id, logical_template_id),
                CONSTRAINT fk_school_certificate_templates_school
                    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await queryRunner.query(`
            ALTER TABLE enrollments
                ADD COLUMN current_school_student_level_id CHAR(36) NULL,
                ADD CONSTRAINT fk_enrollments_current_school_student_level
                    FOREIGN KEY (current_school_student_level_id) REFERENCES school_student_levels(id) ON DELETE SET NULL
        `);

        await queryRunner.query(`
            CREATE TABLE enrollment_level_promotions (
                id CHAR(36) NOT NULL PRIMARY KEY,
                enrollment_id CHAR(36) NOT NULL,
                from_level_id CHAR(36) NULL,
                to_level_id CHAR(36) NULL,
                from_level_label_snapshot VARCHAR(191) NULL,
                to_level_label_snapshot VARCHAR(191) NULL,
                from_level_sort_order_snapshot INT NULL,
                to_level_sort_order_snapshot INT NULL,
                promoted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                notes TEXT NULL,
                created_by_user_id CHAR(36) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_enrollment_level_promotions_enrollment (enrollment_id),
                INDEX idx_enrollment_level_promotions_promoted_at (enrollment_id, promoted_at),
                CONSTRAINT fk_enrollment_level_promotions_enrollment
                    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT,
                CONSTRAINT fk_enrollment_level_promotions_from_level
                    FOREIGN KEY (from_level_id) REFERENCES school_student_levels(id) ON DELETE SET NULL,
                CONSTRAINT fk_enrollment_level_promotions_to_level
                    FOREIGN KEY (to_level_id) REFERENCES school_student_levels(id) ON DELETE SET NULL,
                CONSTRAINT fk_enrollment_level_promotions_created_by
                    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await queryRunner.query(`
            CREATE TABLE enrollment_promotion_certificates (
                id CHAR(36) NOT NULL PRIMARY KEY,
                enrollment_id CHAR(36) NOT NULL,
                promotion_id CHAR(36) NOT NULL,
                certificate_template_id CHAR(36) NOT NULL,
                issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                document_url VARCHAR(2048) NULL,
                metadata JSON NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_enrollment_promotion_certificates_enrollment (enrollment_id),
                UNIQUE KEY uq_enrollment_promotion_certificates_promotion (promotion_id),
                CONSTRAINT fk_enrollment_promotion_certificates_enrollment
                    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT,
                CONSTRAINT fk_enrollment_promotion_certificates_promotion
                    FOREIGN KEY (promotion_id) REFERENCES enrollment_level_promotions(id) ON DELETE RESTRICT,
                CONSTRAINT fk_enrollment_promotion_certificates_template
                    FOREIGN KEY (certificate_template_id) REFERENCES school_certificate_templates(id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await queryRunner.query(`
            CREATE TABLE enrollment_timeline_events (
                id CHAR(36) NOT NULL PRIMARY KEY,
                enrollment_id CHAR(36) NOT NULL,
                event_type VARCHAR(64) NOT NULL,
                payload JSON NULL,
                occurred_at DATETIME NOT NULL,
                actor_user_id CHAR(36) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_enrollment_timeline_events_enrollment_occurred (enrollment_id, occurred_at),
                CONSTRAINT fk_enrollment_timeline_events_enrollment
                    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT,
                CONSTRAINT fk_enrollment_timeline_events_actor
                    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS enrollment_timeline_events');
        await queryRunner.query('DROP TABLE IF EXISTS enrollment_promotion_certificates');
        await queryRunner.query('DROP TABLE IF EXISTS enrollment_level_promotions');
        await queryRunner.query(`
            ALTER TABLE enrollments
                DROP FOREIGN KEY fk_enrollments_current_school_student_level,
                DROP COLUMN current_school_student_level_id
        `);
        await queryRunner.query('DROP TABLE IF EXISTS school_certificate_templates');
        await queryRunner.query('DROP TABLE IF EXISTS school_student_levels');
    }
}
