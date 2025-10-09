import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClassSessions1000000000010 implements MigrationInterface {
    name = 'CreateClassSessions1000000000010';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE class_sessions (
                id CHAR(36) NOT NULL,
                school_id CHAR(36) NOT NULL,
                course_class_id CHAR(36) NOT NULL,
                starts_at DATETIME NOT NULL,
                ends_at DATETIME NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
                location VARCHAR(191) NULL,
                notes TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_class_sessions_class_start (course_class_id, starts_at),
                KEY idx_class_sessions_school_start (school_id, starts_at),
                CONSTRAINT fk_class_sessions_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
                CONSTRAINT fk_class_sessions_course_class FOREIGN KEY (course_class_id) REFERENCES course_classes(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS class_sessions');
    }
}
