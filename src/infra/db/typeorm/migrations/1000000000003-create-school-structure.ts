import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchoolStructure1000000000003 implements MigrationInterface {
    name = 'CreateSchoolStructure1000000000003'

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE IF NOT EXISTS schools (
                id CHAR(36) PRIMARY KEY,
                name VARCHAR(191) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        await q.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id CHAR(36) PRIMARY KEY,
                school_id CHAR(36) NOT NULL,
                name VARCHAR(191) NOT NULL,
                description TEXT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_courses_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        await q.query(`
            CREATE TABLE IF NOT EXISTS course_classes (
                id CHAR(36) PRIMARY KEY,
                course_id CHAR(36) NOT NULL,
                label VARCHAR(191) NOT NULL,
                schedule JSON NOT NULL,
                capacity INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_course_classes_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                CONSTRAINT uq_course_classes_course_label UNIQUE (course_id, label)
            ) ENGINE=InnoDB;
        `);

        await q.query(`
            CREATE TABLE IF NOT EXISTS dependents (
                id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                full_name VARCHAR(191) NOT NULL,
                birth_date DATE NULL,
                relationship VARCHAR(64) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_dependents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        await q.query(`
            CREATE TABLE IF NOT EXISTS enrollments (
                id CHAR(36) PRIMARY KEY,
                course_class_id CHAR(36) NOT NULL,
                owner_user_id CHAR(36) NOT NULL,
                student_type ENUM('USER','DEPENDENT') NOT NULL,
                student_user_id CHAR(36) NULL,
                dependent_id CHAR(36) NULL,
                status ENUM('PENDING','ACTIVE','COMPLETED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
                enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_enrollments_class FOREIGN KEY (course_class_id) REFERENCES course_classes(id) ON DELETE CASCADE,
                CONSTRAINT fk_enrollments_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_enrollments_student_user FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_enrollments_dependent FOREIGN KEY (dependent_id) REFERENCES dependents(id) ON DELETE SET NULL,
                CONSTRAINT uq_enrollments_class_student_user UNIQUE (course_class_id, student_user_id),
                CONSTRAINT uq_enrollments_class_dependent UNIQUE (course_class_id, dependent_id)
            ) ENGINE=InnoDB;
        `);

        await q.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id CHAR(36) PRIMARY KEY,
                scope ENUM('USER','SCHOOL','CLASS') NOT NULL,
                school_id CHAR(36) NULL,
                user_id CHAR(36) NULL,
                course_class_id CHAR(36) NULL,
                title VARCHAR(191) NOT NULL,
                message TEXT NOT NULL,
                metadata JSON NULL,
                sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                read_at DATETIME NULL,
                CONSTRAINT fk_notifications_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
                CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_notifications_class FOREIGN KEY (course_class_id) REFERENCES course_classes(id) ON DELETE SET NULL
            ) ENGINE=InnoDB;
        `);

        await q.query(`
            CREATE TABLE IF NOT EXISTS enrollment_requests (
                id CHAR(36) PRIMARY KEY,
                school_id CHAR(36) NOT NULL,
                course_class_id CHAR(36) NOT NULL,
                requested_for_user_id CHAR(36) NOT NULL,
                requested_for_dependent_id CHAR(36) NULL,
                status ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
                decided_at DATETIME NULL,
                decided_by_user_id CHAR(36) NULL,
                notes VARCHAR(255) NULL,
                enrollment_id CHAR(36) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_enrollment_requests_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
                CONSTRAINT fk_enrollment_requests_class FOREIGN KEY (course_class_id) REFERENCES course_classes(id) ON DELETE CASCADE,
                CONSTRAINT fk_enrollment_requests_user FOREIGN KEY (requested_for_user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_enrollment_requests_dependent FOREIGN KEY (requested_for_dependent_id) REFERENCES dependents(id) ON DELETE SET NULL,
                CONSTRAINT fk_enrollment_requests_decided_by FOREIGN KEY (decided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_enrollment_requests_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL,
                CONSTRAINT uq_enrollment_requests_course_target UNIQUE (course_class_id, requested_for_user_id, requested_for_dependent_id)
            ) ENGINE=InnoDB;
        `);

        await q.query(`
            ALTER TABLE payments
                ADD COLUMN enrollment_id CHAR(36) NULL AFTER customer_id,
                ADD CONSTRAINT fk_payments_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL;
        `);
        await q.query('CREATE INDEX idx_payments_enrollment ON payments(enrollment_id);');
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query('DROP INDEX idx_payments_enrollment ON payments;');
        await q.query('ALTER TABLE payments DROP FOREIGN KEY fk_payments_enrollment;');
        await q.query('ALTER TABLE payments DROP COLUMN enrollment_id;');

        await q.query('DROP TABLE IF EXISTS enrollment_requests;');
        await q.query('DROP TABLE IF EXISTS notifications;');
        await q.query('DROP TABLE IF EXISTS enrollments;');
        await q.query('DROP TABLE IF EXISTS dependents;');
        await q.query('DROP TABLE IF EXISTS course_classes;');
        await q.query('DROP TABLE IF EXISTS courses;');
        await q.query('DROP TABLE IF EXISTS schools;');
    }
}
