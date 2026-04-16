import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventLogs1000000000066 implements MigrationInterface {
    name = 'CreateEventLogs1000000000066';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE event_logs (
                id CHAR(36) NOT NULL PRIMARY KEY,
                type VARCHAR(128) NOT NULL,
                recipient VARCHAR(191) NULL,
                dispatched_at DATETIME NOT NULL,
                status VARCHAR(16) NOT NULL,
                payload JSON NULL,
                error_message MEDIUMTEXT NULL,
                INDEX idx_event_logs_type_dispatched (type, dispatched_at DESC),
                INDEX idx_event_logs_status_dispatched (status, dispatched_at DESC),
                INDEX idx_event_logs_dispatched (dispatched_at DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS event_logs');
    }
}

