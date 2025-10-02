import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolAddresses1000000000006 implements MigrationInterface {
    name = 'AddSchoolAddresses1000000000006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS school_addresses (
                id CHAR(36) PRIMARY KEY,
                school_id CHAR(36) NOT NULL,
                street VARCHAR(191) NOT NULL,
                number VARCHAR(32) NOT NULL,
                complement VARCHAR(191) NULL,
                district VARCHAR(128) NULL,
                city VARCHAR(128) NOT NULL,
                state VARCHAR(64) NOT NULL,
                zip_code VARCHAR(16) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_school_addresses_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        await queryRunner.query('CREATE INDEX idx_school_addresses_school ON school_addresses(school_id);');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX idx_school_addresses_school ON school_addresses;');
        await queryRunner.query('DROP TABLE IF EXISTS school_addresses;');
    }
}
