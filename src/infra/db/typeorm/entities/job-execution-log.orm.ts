import { Column, Entity, PrimaryColumn } from 'typeorm';

export type JobExecutionLogStatusOrm = 'completed' | 'failed';

@Entity('job_execution_logs')
export class JobExecutionLogOrm {
    @PrimaryColumn('char', { length: 36 })
    id!: string;

    @Column('varchar', { length: 16 })
    status!: JobExecutionLogStatusOrm;

    @Column('varchar', { length: 128, name: 'job_name' })
    jobName!: string;

    @Column('varchar', { length: 128, name: 'outbox_type', nullable: true })
    outboxType!: string | null;

    @Column('varchar', { length: 64, name: 'aggregate_id', nullable: true })
    aggregateId!: string | null;

    @Column('varchar', { length: 128, name: 'bullmq_job_id', nullable: true })
    bullmqJobId!: string | null;

    @Column('int', { name: 'attempts_made', default: 0 })
    attemptsMade!: number;

    @Column('datetime', { name: 'processed_at', nullable: true })
    processedAt!: Date | null;

    @Column('datetime', { name: 'finished_at' })
    finishedAt!: Date;

    @Column('int', { name: 'duration_ms', nullable: true })
    durationMs!: number | null;

    @Column('text', { name: 'error_message', nullable: true })
    errorMessage!: string | null;

    @Column('mediumtext', { name: 'error_stack', nullable: true })
    errorStack!: string | null;

    @Column('json', { name: 'result_summary', nullable: true })
    resultSummary!: Record<string, unknown> | null;
}
