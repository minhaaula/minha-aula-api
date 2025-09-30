import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPersona1000000000005 implements MigrationInterface {
    name = 'AddUserPersona1000000000005';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
            ADD COLUMN persona VARCHAR(16) NULL AFTER address_zip_code;
        `);

        await queryRunner.query(`
            UPDATE users
            SET persona = 'STUDENT'
            WHERE persona IS NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE users
            MODIFY persona VARCHAR(16) NOT NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
            DROP COLUMN persona;
        `);
    }
}
