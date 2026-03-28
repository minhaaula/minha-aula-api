export type JobExecutionLogStatus = 'completed' | 'failed';

export class JobExecutionLog {
    private constructor(
        public readonly id: string,
        public readonly status: JobExecutionLogStatus,
        public readonly jobName: string,
        public readonly outboxType: string | null,
        public readonly aggregateId: string | null,
        public readonly bullmqJobId: string | null,
        public readonly attemptsMade: number,
        public readonly processedAt: Date | null,
        public readonly finishedAt: Date,
        public readonly durationMs: number | null,
        public readonly errorMessage: string | null,
        public readonly errorStack: string | null,
        public readonly resultSummary: Record<string, unknown> | null
    ) {}

    static create(params: {
        id: string;
        status: JobExecutionLogStatus;
        jobName: string;
        outboxType?: string | null;
        aggregateId?: string | null;
        bullmqJobId?: string | null;
        attemptsMade?: number;
        processedAt?: Date | null;
        finishedAt: Date;
        durationMs?: number | null;
        errorMessage?: string | null;
        errorStack?: string | null;
        resultSummary?: Record<string, unknown> | null;
    }) {
        const jobName = params.jobName.trim();
        if (!jobName) throw new Error('jobName is required');

        return new JobExecutionLog(
            params.id,
            params.status,
            jobName,
            params.outboxType?.trim() || null,
            params.aggregateId?.trim() || null,
            params.bullmqJobId?.trim() || null,
            params.attemptsMade ?? 0,
            params.processedAt ?? null,
            params.finishedAt,
            params.durationMs ?? null,
            params.errorMessage ?? null,
            params.errorStack ?? null,
            params.resultSummary ?? null
        );
    }
}
