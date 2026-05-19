import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteSchoolsUsers1000000000078 implements MigrationInterface {
    name = 'AddSoftDeleteSchoolsUsers1000000000078';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn('users', 'deleted_at'))) {
            await queryRunner.query(`
                ALTER TABLE users
                ADD COLUMN deleted_at DATETIME NULL AFTER deactivation_description
            `);
        }

        if (!(await queryRunner.hasColumn('schools', 'active'))) {
            await queryRunner.query(`
                ALTER TABLE schools
                ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER created_at
            `);
        }

        if (!(await queryRunner.hasColumn('schools', 'deleted_at'))) {
            await queryRunner.query(`
                ALTER TABLE schools
                ADD COLUMN deleted_at DATETIME NULL AFTER active
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn('schools', 'deleted_at')) {
            await queryRunner.query('ALTER TABLE schools DROP COLUMN deleted_at');
        }
        if (await queryRunner.hasColumn('schools', 'active')) {
            await queryRunner.query('ALTER TABLE schools DROP COLUMN active');
        }
        if (await queryRunner.hasColumn('users', 'deleted_at')) {
            await queryRunner.query('ALTER TABLE users DROP COLUMN deleted_at');
        }
    }
}
