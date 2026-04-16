import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCronLogs1000000000065 implements MigrationInterface {
    name = 'CreateCronLogs1000000000065';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE cron_logs (
                id CHAR(36) NOT NULL PRIMARY KEY,
                cron_name VARCHAR(128) NOT NULL,
                started_at DATETIME NOT NULL,
                finished_at DATETIME NOT NULL,
                status VARCHAR(16) NOT NULL,
                error_message MEDIUMTEXT NULL,
                INDEX idx_cron_logs_cron_finished (cron_name, finished_at DESC),
                INDEX idx_cron_logs_status_finished (status, finished_at DESC),
                INDEX idx_cron_logs_finished (finished_at DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS cron_logs');
    }
}

