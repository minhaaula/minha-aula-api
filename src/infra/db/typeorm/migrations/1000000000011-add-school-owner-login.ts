import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolOwnerLogin1000000000011 implements MigrationInterface {
    name = 'AddSchoolOwnerLogin1000000000011';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE schools
                ADD COLUMN owner_name VARCHAR(191) NULL AFTER owner_user_id,
                ADD COLUMN owner_cpf CHAR(11) NULL AFTER owner_name,
                ADD COLUMN owner_email VARCHAR(191) NULL AFTER owner_cpf,
                ADD COLUMN owner_password_hash VARCHAR(255) NULL AFTER owner_email;
        `);

        await queryRunner.query('CREATE INDEX idx_schools_owner_email ON schools(owner_email);');
        await queryRunner.query('CREATE INDEX idx_schools_owner_cpf ON schools(owner_cpf);');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX idx_schools_owner_cpf ON schools;');
        await queryRunner.query('DROP INDEX idx_schools_owner_email ON schools;');
        await queryRunner.query(`
            ALTER TABLE schools
                DROP COLUMN owner_password_hash,
                DROP COLUMN owner_email,
                DROP COLUMN owner_cpf,
                DROP COLUMN owner_name;
        `);
    }
}
