import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite nova matrícula na mesma turma após cancelamento (linha CANCELLED permanece no histórico).
 * Unicidade só para matrículas ACTIVE/PENDING.
 */
export class EnrollmentPartialUniqueActive1000000000079 implements MigrationInterface {
    name = 'EnrollmentPartialUniqueActive1000000000079';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE enrollments
            DROP INDEX uq_enrollments_class_student_user,
            DROP INDEX uq_enrollments_class_dependent
        `);

        if (!(await queryRunner.hasColumn('enrollments', 'active_class_student_user_key'))) {
            await queryRunner.query(`
                ALTER TABLE enrollments
                ADD COLUMN active_class_student_user_key VARCHAR(73) AS (
                    IF(
                        status IN ('ACTIVE', 'PENDING') AND student_user_id IS NOT NULL,
                        CONCAT(course_class_id, '|', student_user_id),
                        NULL
                    )
                ) STORED
            `);
        }

        if (!(await queryRunner.hasColumn('enrollments', 'active_class_dependent_key'))) {
            await queryRunner.query(`
                ALTER TABLE enrollments
                ADD COLUMN active_class_dependent_key VARCHAR(73) AS (
                    IF(
                        status IN ('ACTIVE', 'PENDING') AND dependent_id IS NOT NULL,
                        CONCAT(course_class_id, '|', dependent_id),
                        NULL
                    )
                ) STORED
            `);
        }

        await queryRunner.query(`
            CREATE UNIQUE INDEX uq_enrollments_active_class_student_user
            ON enrollments (active_class_student_user_key)
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX uq_enrollments_active_class_dependent
            ON enrollments (active_class_dependent_key)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE enrollments
            DROP INDEX uq_enrollments_active_class_student_user,
            DROP INDEX uq_enrollments_active_class_dependent
        `);

        if (await queryRunner.hasColumn('enrollments', 'active_class_student_user_key')) {
            await queryRunner.query('ALTER TABLE enrollments DROP COLUMN active_class_student_user_key');
        }
        if (await queryRunner.hasColumn('enrollments', 'active_class_dependent_key')) {
            await queryRunner.query('ALTER TABLE enrollments DROP COLUMN active_class_dependent_key');
        }

        await queryRunner.query(`
            CREATE UNIQUE INDEX uq_enrollments_class_student_user
            ON enrollments (course_class_id, student_user_id)
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX uq_enrollments_class_dependent
            ON enrollments (course_class_id, dependent_id)
        `);
    }
}
