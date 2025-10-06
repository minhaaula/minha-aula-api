import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolContactInfo1000000000007 implements MigrationInterface {
    name = 'AddSchoolContactInfo1000000000007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE schools
                ADD COLUMN email VARCHAR(191) NOT NULL DEFAULT 'no-reply@example.com' AFTER name,
                ADD COLUMN phone VARCHAR(32) NOT NULL DEFAULT '0000000000' AFTER email,
                ADD COLUMN cnpj CHAR(14) NOT NULL DEFAULT '00000000000000' AFTER phone;
        `);

        await queryRunner.query('ALTER TABLE schools MODIFY email VARCHAR(191) NOT NULL;');
        await queryRunner.query('ALTER TABLE schools MODIFY phone VARCHAR(32) NOT NULL;');
        await queryRunner.query('ALTER TABLE schools MODIFY cnpj CHAR(14) NOT NULL;');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE schools DROP COLUMN cnpj;');
        await queryRunner.query('ALTER TABLE schools DROP COLUMN phone;');
        await queryRunner.query('ALTER TABLE schools DROP COLUMN email;');
    }
}
