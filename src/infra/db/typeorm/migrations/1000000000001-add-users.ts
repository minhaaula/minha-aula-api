import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsers1000000000001 implements MigrationInterface {
    name = 'AddUsers1000000000001';

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE IF NOT EXISTS users (
                id CHAR(36) PRIMARY KEY,
                email VARCHAR(191) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query('DROP TABLE IF EXISTS users;');
    }
}
