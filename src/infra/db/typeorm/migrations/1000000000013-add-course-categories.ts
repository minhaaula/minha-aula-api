import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseCategories1000000000013 implements MigrationInterface {
    name = 'AddCourseCategories1000000000013';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE courses
                ADD COLUMN category_id VARCHAR(191) NOT NULL DEFAULT 'general' AFTER description,
                ADD COLUMN subcategory_id VARCHAR(191) NOT NULL DEFAULT 'general' AFTER category_id;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE courses
                DROP COLUMN subcategory_id,
                DROP COLUMN category_id;
        `);
    }
}
