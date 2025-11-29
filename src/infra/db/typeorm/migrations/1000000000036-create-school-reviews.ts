import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchoolReviews1000000000036 implements MigrationInterface {
    name = 'CreateSchoolReviews1000000000036';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS school_reviews (
                id CHAR(36) PRIMARY KEY,
                school_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                rating TINYINT NOT NULL,
                description TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_school_reviews_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
                CONSTRAINT fk_school_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_school_reviews_school (school_id),
                INDEX idx_school_reviews_user (user_id),
                INDEX idx_school_reviews_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS school_reviews;');
    }
}

