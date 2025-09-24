import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendUsersProfile1000000000002 implements MigrationInterface {
    name = 'ExtendUsersProfile1000000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
                ADD COLUMN full_name VARCHAR(191) NULL AFTER id,
                ADD COLUMN birth_date DATE NULL AFTER full_name,
                ADD COLUMN phone VARCHAR(32) NULL AFTER email,
                ADD COLUMN cpf CHAR(11) NULL AFTER phone,
                ADD COLUMN address VARCHAR(255) NULL AFTER cpf;
        `);

        await queryRunner.query('ALTER TABLE users ADD UNIQUE INDEX uq_users_cpf (cpf);');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE users DROP INDEX uq_users_cpf;');
        await queryRunner.query(`
            ALTER TABLE users
                DROP COLUMN address,
                DROP COLUMN cpf,
                DROP COLUMN phone,
                DROP COLUMN birth_date,
                DROP COLUMN full_name;
        `);
    }
}
