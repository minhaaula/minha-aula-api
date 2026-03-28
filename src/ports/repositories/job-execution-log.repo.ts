import { JobExecutionLog } from '../../domain/entities/job-execution-log';

export type JobExecutionLogListFilter = {
    status?: 'completed' | 'failed';
    jobName?: string;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
};

export type JobExecutionLogSummaryFilter = {
    jobName?: string;
    from?: Date;
    to?: Date;
};

export interface JobExecutionLogRepository {
    save(log: JobExecutionLog): Promise<void>;
    findById(id: string): Promise<JobExecutionLog | null>;
    list(filter: JobExecutionLogListFilter): Promise<{ items: JobExecutionLog[]; total: number }>;
    countByStatus(filter: JobExecutionLogSummaryFilter): Promise<{ completed: number; failed: number }>;
}
