import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetTokens1000000000032 implements MigrationInterface {
    name = 'CreatePasswordResetTokens1000000000032';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id CHAR(36) PRIMARY KEY,
                email VARCHAR(191) NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires_at DATETIME NOT NULL,
                used TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_password_reset_tokens_token (token),
                INDEX idx_password_reset_tokens_email (email),
                INDEX idx_password_reset_tokens_expires_at (expires_at)
            ) ENGINE=InnoDB;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS password_reset_tokens;');
    }
}

