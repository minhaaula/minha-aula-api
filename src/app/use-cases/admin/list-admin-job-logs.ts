import { JobExecutionLog } from '../../../domain/entities/job-execution-log';
import { JobExecutionLogRepository } from '../../../ports/repositories/job-execution-log.repo';
import { AppError } from '../../../shared/errors';

export type ListAdminJobLogsInput = {
    status?: 'completed' | 'failed';
    jobName?: string | null;
    from?: Date | null;
    to?: Date | null;
    limit?: number;
    offset?: number;
};

export type JobExecutionLogView = {
    id: string;
    status: 'completed' | 'failed';
    jobName: string;
    outboxType: string | null;
    aggregateId: string | null;
    bullmqJobId: string | null;
    attemptsMade: number;
    processedAt: string | null;
    finishedAt: string;
    durationMs: number | null;
    errorMessage: string | null;
    errorStack: string | null;
    resultSummary: Record<string, unknown> | null;
};

export type ListAdminJobLogsOutput = {
    items: JobExecutionLogView[];
    total: number;
    limit: number;
    offset: number;
    summary: {
        completed: number;
        failed: number;
    };
};

export function mapJobExecutionLogToView(row: JobExecutionLog): JobExecutionLogView {
    return {
        id: row.id,
        status: row.status,
        jobName: row.jobName,
        outboxType: row.outboxType,
        aggregateId: row.aggregateId,
        bullmqJobId: row.bullmqJobId,
        attemptsMade: row.attemptsMade,
        processedAt: row.processedAt ? row.processedAt.toISOString() : null,
        finishedAt: row.finishedAt.toISOString(),
        durationMs: row.durationMs,
        errorMessage: row.errorMessage,
        errorStack: row.errorStack,
        resultSummary: row.resultSummary
    };
}

export class ListAdminJobLogs {
    constructor(private readonly logs: JobExecutionLogRepository) {}

    async exec(input: ListAdminJobLogsInput): Promise<ListAdminJobLogsOutput> {
        const limit = Math.min(100, Math.max(1, input.limit ?? 50));
        const offset = Math.max(0, input.offset ?? 0);
        const jobName = input.jobName?.trim() || undefined;
        const from = input.from ?? undefined;
        const to = input.to ?? undefined;

        if (from && to && from.getTime() > to.getTime()) {
            throw AppError.validation('"from" deve ser anterior ou igual a "to"', { from, to });
        }

        const [listResult, summary] = await Promise.all([
            this.logs.list({
                status: input.status,
                jobName,
                from,
                to,
                limit,
                offset
            }),
            this.logs.countByStatus({
                jobName,
                from,
                to
            })
        ]);

        return {
            items: listResult.items.map(mapJobExecutionLogToView),
            total: listResult.total,
            limit,
            offset,
            summary
        };
    }
}
