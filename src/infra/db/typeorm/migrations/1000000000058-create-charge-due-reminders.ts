import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChargeDueReminders1000000000058 implements MigrationInterface {
    name = 'CreateChargeDueReminders1000000000058';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE charge_due_reminders (
                id CHAR(36) NOT NULL PRIMARY KEY,
                charge_type VARCHAR(32) NOT NULL,
                charge_id CHAR(36) NOT NULL,
                sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_charge_due_reminder (charge_type, charge_id),
                INDEX idx_charge_due_reminders_charge (charge_type, charge_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS charge_due_reminders');
    }
}
