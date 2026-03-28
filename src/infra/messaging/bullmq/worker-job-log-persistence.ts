import type { Job } from 'bullmq';
import { JobExecutionLog } from '../../../domain/entities/job-execution-log';
import { JobExecutionLogRepositoryAdapter } from '../../db/typeorm/job-execution-log-repository.adapter';
import { AppDataSource } from '../../db/typeorm/datasource';
import { log } from '../../../shared/logger';
import { sanitizeForLogging } from '../../../shared/log-sanitizer';
import { Uuid } from '../../../shared/uuid';

type OutboxEvent = { type?: string; payload?: unknown; aggregateId?: string };

const MAX_ERROR_MSG = 4000;
const MAX_ERROR_STACK = 16000;
const MAX_RESULT_JSON = 32000;

async function ensureDb() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
}

function truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return str.slice(0, max) + '...[truncated]';
}

function safeResultSummary(job: Job): Record<string, unknown> | null {
    const data = job.data as OutboxEvent | undefined;
    const summary: Record<string, unknown> = {
        jobName: job.name,
        outboxType: data?.type ?? null,
        aggregateId: data?.aggregateId ?? null
    };
    const payloadSan = data?.payload !== undefined ? sanitizeForLogging(data.payload) : undefined;
    if (payloadSan !== undefined) {
        summary.payload = payloadSan;
    }

    const rv = job.returnvalue;
    if (rv !== undefined && rv !== null) {
        if (typeof rv === 'object') {
            summary.returnValue = sanitizeForLogging(rv);
        } else {
            summary.returnValue = rv;
        }
    }

    let json = JSON.stringify(summary);
    if (json.length > MAX_RESULT_JSON) {
        summary.payload = '[omitted: payload too large]';
        summary.returnValue =
            typeof summary.returnValue === 'object' && summary.returnValue !== null
                ? '[omitted]'
                : summary.returnValue;
        json = JSON.stringify(summary);
        if (json.length > MAX_RESULT_JSON) {
            return { note: 'Result summary truncated', jobName: job.name };
        }
    }
    return summary;
}

/**
 * Persiste conclusão bem-sucedida de job (fila outbox) para consulta no admin.
 */
export async function persistCompletedJobLog(job: Job): Promise<void> {
    try {
        await ensureDb();
        const repo = new JobExecutionLogRepositoryAdapter();
        const data = job.data as OutboxEvent | undefined;
        const finishedOn = job.finishedOn ? job.finishedOn : Date.now();
        const processedOn = job.processedOn ?? null;
        const durationMs =
            processedOn != null && job.finishedOn != null ? Math.max(0, job.finishedOn - processedOn) : null;

        const entity = JobExecutionLog.create({
            id: Uuid(),
            status: 'completed',
            jobName: String(job.name ?? 'unknown'),
            outboxType: data?.type ?? null,
            aggregateId: data?.aggregateId ?? null,
            bullmqJobId: job.id != null ? String(job.id) : null,
            attemptsMade: job.attemptsMade ?? 0,
            processedAt: processedOn != null ? new Date(processedOn) : null,
            finishedAt: new Date(finishedOn),
            durationMs,
            errorMessage: null,
            errorStack: null,
            resultSummary: safeResultSummary(job)
        });
        await repo.save(entity);
    } catch (e) {
        log.warn('[Worker] Falha ao persistir log de job (completed)', {
            error: e instanceof Error ? e.message : String(e)
        });
    }
}

/**
 * Persiste falha de job para consulta no admin.
 */
export async function persistFailedJobLog(job: Job | undefined, err: Error): Promise<void> {
    try {
        await ensureDb();
        const repo = new JobExecutionLogRepositoryAdapter();
        const data = job?.data as OutboxEvent | undefined;
        const finishedOn = job?.finishedOn ? job.finishedOn : Date.now();
        const processedOn = job?.processedOn ?? null;
        const durationMs =
            job && processedOn != null && job.finishedOn != null
                ? Math.max(0, job.finishedOn - processedOn)
                : null;

        const entity = JobExecutionLog.create({
            id: Uuid(),
            status: 'failed',
            jobName: String(job?.name ?? 'unknown'),
            outboxType: data?.type ?? null,
            aggregateId: data?.aggregateId ?? null,
            bullmqJobId: job?.id != null ? String(job.id) : null,
            attemptsMade: job?.attemptsMade ?? 0,
            processedAt: processedOn != null ? new Date(processedOn) : null,
            finishedAt: new Date(finishedOn),
            durationMs,
            errorMessage: truncate(err.message || 'Error', MAX_ERROR_MSG),
            errorStack: err.stack ? truncate(err.stack, MAX_ERROR_STACK) : null,
            resultSummary: job ? safeResultSummary(job) : null
        });
        await repo.save(entity);
    } catch (e) {
        log.warn('[Worker] Falha ao persistir log de job (failed)', {
            error: e instanceof Error ? e.message : String(e)
        });
    }
}
