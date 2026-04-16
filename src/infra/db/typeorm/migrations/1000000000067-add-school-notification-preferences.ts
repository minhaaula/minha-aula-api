import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolNotificationPreferences1000000000067 implements MigrationInterface {
    name = 'AddSchoolNotificationPreferences1000000000067';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE schools
                ADD notifications_email_enabled TINYINT(1) NOT NULL DEFAULT 1,
                ADD notifications_whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 1,
                ADD notifications_push_enabled TINYINT(1) NOT NULL DEFAULT 1
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE schools
                DROP COLUMN notifications_email_enabled,
                DROP COLUMN notifications_whatsapp_enabled,
                DROP COLUMN notifications_push_enabled
        `);
    }
}

