import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolOwner1000000000008 implements MigrationInterface {
    name = 'AddSchoolOwner1000000000008';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE schools
                ADD COLUMN owner_user_id CHAR(36) NULL AFTER cnpj,
                ADD CONSTRAINT fk_schools_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
        `);

        await queryRunner.query('CREATE INDEX idx_schools_owner_user ON schools(owner_user_id);');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX idx_schools_owner_user ON schools;');
        await queryRunner.query('ALTER TABLE schools DROP FOREIGN KEY fk_schools_owner;');
        await queryRunner.query('ALTER TABLE schools DROP COLUMN owner_user_id;');
    }
}
