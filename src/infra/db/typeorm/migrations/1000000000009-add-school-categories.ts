import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolCategories1000000000009 implements MigrationInterface {
    name = 'AddSchoolCategories1000000000009';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE categories (
                id CHAR(36) NOT NULL,
                name VARCHAR(191) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_categories_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await queryRunner.query(`
            CREATE TABLE subcategories (
                id CHAR(36) NOT NULL,
                category_id CHAR(36) NOT NULL,
                name VARCHAR(191) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_subcategories_category_name (category_id, name),
                KEY idx_subcategories_category (category_id),
                CONSTRAINT fk_subcategories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await queryRunner.query(`
            CREATE TABLE school_categories (
                id CHAR(36) NOT NULL,
                school_id CHAR(36) NOT NULL,
                category_id CHAR(36) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_school_categories_school_category (school_id, category_id),
                KEY idx_school_categories_school (school_id),
                KEY idx_school_categories_category (category_id),
                CONSTRAINT fk_school_categories_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
                CONSTRAINT fk_school_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await queryRunner.query(`
            CREATE TABLE school_category_subcategories (
                id CHAR(36) NOT NULL,
                school_category_id CHAR(36) NOT NULL,
                subcategory_id CHAR(36) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_school_category_subcategories (school_category_id, subcategory_id),
                KEY idx_school_category_subcategories_school_category (school_category_id),
                KEY idx_school_category_subcategories_subcategory (subcategory_id),
                CONSTRAINT fk_school_category_subcategories_school_category FOREIGN KEY (school_category_id) REFERENCES school_categories(id) ON DELETE CASCADE,
                CONSTRAINT fk_school_category_subcategories_subcategory FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS school_category_subcategories');
        await queryRunner.query('DROP TABLE IF EXISTS school_categories');
        await queryRunner.query('DROP TABLE IF EXISTS subcategories');
        await queryRunner.query('DROP TABLE IF EXISTS categories');
    }
}
