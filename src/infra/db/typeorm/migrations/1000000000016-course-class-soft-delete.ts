import { MigrationInterface, QueryRunner } from 'typeorm';

export class CourseClassSoftDelete1000000000016 implements MigrationInterface {
    name = 'CourseClassSoftDelete1000000000016';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE course_classes
            ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER capacity
        `);

        await queryRunner.query(`
            UPDATE course_classes
            SET is_active = 1
        `);

        await queryRunner.query(`
            ALTER TABLE course_classes
            DROP INDEX uq_course_classes_course_label,
            ADD UNIQUE INDEX uq_course_classes_course_label (course_id, label, is_active)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE course_classes
            DROP INDEX uq_course_classes_course_label,
            ADD UNIQUE INDEX uq_course_classes_course_label (course_id, label)
        `);

        await queryRunner.query(`
            ALTER TABLE course_classes
            DROP COLUMN is_active
        `);
    }
}
