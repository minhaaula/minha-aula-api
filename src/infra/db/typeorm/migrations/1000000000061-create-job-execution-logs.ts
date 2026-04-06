import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobExecutionLogs1000000000061 implements MigrationInterface {
    name = 'CreateJobExecutionLogs1000000000061';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE job_execution_logs (
                id CHAR(36) NOT NULL PRIMARY KEY,
                status VARCHAR(16) NOT NULL,
                job_name VARCHAR(128) NOT NULL,
                outbox_type VARCHAR(128) NULL,
                aggregate_id VARCHAR(64) NULL,
                bullmq_job_id VARCHAR(128) NULL,
                attempts_made INT NOT NULL DEFAULT 0,
                processed_at DATETIME NULL,
                finished_at DATETIME NOT NULL,
                duration_ms INT NULL,
                error_message TEXT NULL,
                error_stack MEDIUMTEXT NULL,
                result_summary JSON NULL,
                INDEX idx_job_execution_logs_finished (finished_at DESC),
                INDEX idx_job_execution_logs_status_finished (status, finished_at DESC),
                INDEX idx_job_execution_logs_job_name (job_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS job_execution_logs');
    }
}
