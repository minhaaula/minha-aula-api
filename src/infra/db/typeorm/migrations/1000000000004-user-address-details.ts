import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAddressDetails1000000000004 implements MigrationInterface {
    name = 'UserAddressDetails1000000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
                ADD COLUMN address_street VARCHAR(191) NULL AFTER address,
                ADD COLUMN address_number VARCHAR(32) NULL AFTER address_street,
                ADD COLUMN address_complement VARCHAR(191) NULL AFTER address_number,
                ADD COLUMN address_district VARCHAR(128) NULL AFTER address_complement,
                ADD COLUMN address_city VARCHAR(128) NULL AFTER address_district,
                ADD COLUMN address_state VARCHAR(64) NULL AFTER address_city,
                ADD COLUMN address_zip_code VARCHAR(16) NULL AFTER address_state;
        `);

        await queryRunner.query(`
            UPDATE users
            SET
                address_street = COALESCE(address, 'Undefined Street'),
                address_number = COALESCE(address_number, 'S/N'),
                address_city = COALESCE(address_city, 'Undefined City'),
                address_state = COALESCE(address_state, 'NA'),
                address_zip_code = COALESCE(address_zip_code, '00000000');
        `);

        await queryRunner.query(`
            ALTER TABLE users
                DROP COLUMN address;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
                ADD COLUMN address VARCHAR(255) NULL AFTER cpf;
        `);

        await queryRunner.query(`
            UPDATE users
            SET address = address_street
            WHERE address IS NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE users
                DROP COLUMN address_zip_code,
                DROP COLUMN address_state,
                DROP COLUMN address_city,
                DROP COLUMN address_district,
                DROP COLUMN address_complement,
                DROP COLUMN address_number,
                DROP COLUMN address_street;
        `);
    }
}
