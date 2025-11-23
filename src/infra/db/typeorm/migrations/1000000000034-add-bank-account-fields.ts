import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankAccountFields1000000000034 implements MigrationInterface {
    name = 'AddBankAccountFields1000000000034';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar campo bank_code (código do banco)
        const hasBankCodeColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_bank_accounts' AND COLUMN_NAME = 'bank_code';
        `);
        if (hasBankCodeColumn.length === 0) {
            await queryRunner.query(`
                ALTER TABLE school_bank_accounts
                ADD COLUMN bank_code INT NULL AFTER bank_name;
            `);
        }

        // Adicionar campo bank_agency_digit (dígito da agência)
        const hasBankAgencyDigitColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_bank_accounts' AND COLUMN_NAME = 'bank_agency_digit';
        `);
        if (hasBankAgencyDigitColumn.length === 0) {
            await queryRunner.query(`
                ALTER TABLE school_bank_accounts
                ADD COLUMN bank_agency_digit VARCHAR(2) NULL AFTER bank_agency;
            `);
        }

        // Adicionar campo bank_account_digit (dígito da conta)
        const hasBankAccountDigitColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_bank_accounts' AND COLUMN_NAME = 'bank_account_digit';
        `);
        if (hasBankAccountDigitColumn.length === 0) {
            await queryRunner.query(`
                ALTER TABLE school_bank_accounts
                ADD COLUMN bank_account_digit VARCHAR(2) NULL AFTER bank_account;
            `);
        }

        // Adicionar campo pix_key (chave PIX)
        const hasPixKeyColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_bank_accounts' AND COLUMN_NAME = 'pix_key';
        `);
        if (hasPixKeyColumn.length === 0) {
            await queryRunner.query(`
                ALTER TABLE school_bank_accounts
                ADD COLUMN pix_key VARCHAR(191) NULL AFTER bank_account_holder_document;
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasPixKeyColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_bank_accounts' AND COLUMN_NAME = 'pix_key';
        `);
        if (hasPixKeyColumn.length > 0) {
            await queryRunner.query('ALTER TABLE school_bank_accounts DROP COLUMN pix_key;');
        }

        const hasBankAccountDigitColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_bank_accounts' AND COLUMN_NAME = 'bank_account_digit';
        `);
        if (hasBankAccountDigitColumn.length > 0) {
            await queryRunner.query('ALTER TABLE school_bank_accounts DROP COLUMN bank_account_digit;');
        }

        const hasBankAgencyDigitColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_bank_accounts' AND COLUMN_NAME = 'bank_agency_digit';
        `);
        if (hasBankAgencyDigitColumn.length > 0) {
            await queryRunner.query('ALTER TABLE school_bank_accounts DROP COLUMN bank_agency_digit;');
        }

        const hasBankCodeColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_bank_accounts' AND COLUMN_NAME = 'bank_code';
        `);
        if (hasBankCodeColumn.length > 0) {
            await queryRunner.query('ALTER TABLE school_bank_accounts DROP COLUMN bank_code;');
        }
    }
}

