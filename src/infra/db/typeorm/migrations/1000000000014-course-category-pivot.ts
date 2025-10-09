import { MigrationInterface, QueryRunner } from 'typeorm';

export class CourseCategoryPivot1000000000014 implements MigrationInterface {
    name = 'CourseCategoryPivot1000000000014';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasCategoryColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'category_id';
        `);
        if (hasCategoryColumn.length > 0) {
            await queryRunner.query('ALTER TABLE courses DROP COLUMN category_id;');
        }

        const hasSubcategoryColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'subcategory_id';
        `);
        if (hasSubcategoryColumn.length > 0) {
            await queryRunner.query('ALTER TABLE courses DROP COLUMN subcategory_id;');
        }

        await queryRunner.query('DROP TABLE IF EXISTS course_category_subcategories;');
        await queryRunner.query('DROP TABLE IF EXISTS course_categories;');
        await queryRunner.query('DROP TABLE IF EXISTS subcategories;');
        await queryRunner.query('DROP TABLE IF EXISTS categories;');

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id CHAR(36) NOT NULL,
                name VARCHAR(191) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_categories_name (name)
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS subcategories (
                id CHAR(36) NOT NULL,
                category_id CHAR(36) NOT NULL,
                name VARCHAR(191) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_subcategories_category_name (category_id, name),
                KEY idx_subcategories_category (category_id),
                CONSTRAINT fk_subcategories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS course_categories (
                id CHAR(36) NOT NULL,
                course_id CHAR(36) NOT NULL,
                category_id CHAR(36) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_course_categories_course_category (course_id, category_id),
                KEY idx_course_categories_course (course_id),
                KEY idx_course_categories_category (category_id),
                CONSTRAINT fk_course_categories_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                CONSTRAINT fk_course_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS course_category_subcategories (
                id CHAR(36) NOT NULL,
                course_category_id CHAR(36) NOT NULL,
                subcategory_id CHAR(36) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_course_category_subcategories (course_category_id, subcategory_id),
                KEY idx_course_category_subcategories_course_category (course_category_id),
                KEY idx_course_category_subcategories_subcategory (subcategory_id),
                CONSTRAINT fk_course_category_subcategories_course_category FOREIGN KEY (course_category_id) REFERENCES course_categories(id) ON DELETE CASCADE,
                CONSTRAINT fk_course_category_subcategories_subcategory FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS course_category_subcategories');
        await queryRunner.query('DROP TABLE IF EXISTS course_categories');
        await queryRunner.query('DROP TABLE IF EXISTS subcategories');
        await queryRunner.query('DROP TABLE IF EXISTS categories');
        await queryRunner.query(`
            ALTER TABLE courses
                ADD COLUMN category_id VARCHAR(191) NOT NULL DEFAULT 'general',
                ADD COLUMN subcategory_id VARCHAR(191) NOT NULL DEFAULT 'general';
        `);
    }
}
