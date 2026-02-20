import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAccountDeactivation1000000000057 implements MigrationInterface {
    name = 'AddUserAccountDeactivation1000000000057';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
            ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER photo_url,
            ADD COLUMN deactivation_reason VARCHAR(64) NULL AFTER active,
            ADD COLUMN deactivation_description TEXT NULL AFTER deactivation_reason
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
            DROP COLUMN active,
            DROP COLUMN deactivation_reason,
            DROP COLUMN deactivation_description
        `);
    }
}
