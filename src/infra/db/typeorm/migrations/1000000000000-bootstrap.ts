import { MigrationInterface, QueryRunner } from 'typeorm';

export class Bootstrap1000000000000 implements MigrationInterface {
    name = 'Bootstrap1000000000000'
    public async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE IF NOT EXISTS payments (
            id CHAR(36) PRIMARY KEY,
            amount INT NOT NULL,
            currency VARCHAR(3) NOT NULL,
            status VARCHAR(16) NOT NULL,
            method VARCHAR(16) NOT NULL,
            customer_id VARCHAR(64) NOT NULL,
            metadata JSON NOT NULL,
            provider_ref VARCHAR(64) NULL,
            version INT NOT NULL DEFAULT 0
            );
        `);
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query('DROP TABLE IF EXISTS payments;');
    }
}
