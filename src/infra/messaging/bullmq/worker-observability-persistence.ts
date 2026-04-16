import type { Job } from 'bullmq';
import { AppDataSource } from '../../db/typeorm/datasource';
import { CronLog } from '../../../domain/entities/cron-log';
import { EventLog } from '../../../domain/entities/event-log';
import { CronLogRepositoryAdapter } from '../../db/typeorm/cron-log-repository.adapter';
import { EventLogRepositoryAdapter } from '../../db/typeorm/event-log-repository.adapter';
import { log } from '../../../shared/logger';
import { sanitizeForLogging } from '../../../shared/log-sanitizer';
import { Uuid } from '../../../shared/uuid';

type OutboxEvent = { type?: string; payload?: unknown; aggregateId?: string };

const MAX_ERROR = 24000;

async function ensureDb() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
}

function truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return str.slice(0, max) + '...[truncated]';
}

function formatErrorWithStack(err: Error): string {
    const msg = String(err.message || 'Error');
    const stack = err.stack ? `\n${err.stack}` : '';
    return truncate(msg + stack, MAX_ERROR);
}

function isCronJob(job: Job): boolean {
    // BullMQ marca jobs repetitivos com opts.repeat; além disso temos alguns jobs "tipo cron" específicos.
    const hasRepeat = Boolean((job.opts as { repeat?: unknown } | undefined)?.repeat);
    if (hasRepeat) return true;
    return (
        job.name === 'fetch_payment_receipts' ||
        job.name === 'sync_payment_status' ||
        job.name === 'fetch_school_onboarding_url' ||
        job.name === 'schedule_charge_due_reminders' ||
        job.name === 'generate_monthly_tuition_charges' ||
        job.name === 'send_boleto_notifications'
    );
}

function isDispatchEventJob(job: Job): boolean {
    return job.name === 'push_notification' || job.name === 'whatsapp_notification';
}

function inferRecipient(job: Job): string | null {
    const data = job.data as OutboxEvent | undefined;
    const payload = data?.payload as Record<string, unknown> | undefined;

    if (job.name === 'whatsapp_notification') {
        const to = typeof payload?.to === 'string' ? payload.to.trim() : '';
        if (to) return to;
        const userIds = Array.isArray(payload?.userIds) ? payload.userIds : [];
        return userIds.length ? `userIds:${userIds.length}` : null;
    }

    if (job.name === 'push_notification') {
        const userIds = Array.isArray(payload?.userIds) ? payload.userIds : [];
        return userIds.length ? `userIds:${userIds.length}` : null;
    }

    return null;
}

function safePayload(job: Job): Record<string, unknown> | null {
    const data = job.data as OutboxEvent | undefined;
    if (data?.payload === undefined || data?.payload === null) return null;
    const p = data.payload;
    if (typeof p === 'object') {
        return sanitizeForLogging(p) as Record<string, unknown>;
    }
    return { value: p };
}

export async function persistCronCompletionFromJob(job: Job): Promise<void> {
    if (!isCronJob(job)) return;
    try {
        await ensureDb();
        const repo = new CronLogRepositoryAdapter();
        const startedOn = job.processedOn ?? job.timestamp ?? Date.now();
        const finishedOn = job.finishedOn ?? Date.now();

        const entity = CronLog.create({
            id: Uuid(),
            cronName: String(job.name ?? 'unknown'),
            startedAt: new Date(startedOn),
            finishedAt: new Date(finishedOn),
            status: 'completed',
            errorMessage: null
        });
        await repo.save(entity);
    } catch (e) {
        log.warn('[Worker] Falha ao persistir cron_log (completed)', {
            error: e instanceof Error ? e.message : String(e)
        });
    }
}

export async function persistCronFailureFromJob(job: Job | undefined, err: Error): Promise<void> {
    if (!job || !isCronJob(job)) return;
    try {
        await ensureDb();
        const repo = new CronLogRepositoryAdapter();
        const startedOn = job.processedOn ?? job.timestamp ?? Date.now();
        const finishedOn = job.finishedOn ?? Date.now();

        const entity = CronLog.create({
            id: Uuid(),
            cronName: String(job.name ?? 'unknown'),
            startedAt: new Date(startedOn),
            finishedAt: new Date(finishedOn),
            status: 'failed',
            errorMessage: formatErrorWithStack(err)
        });
        await repo.save(entity);
    } catch (e) {
        log.warn('[Worker] Falha ao persistir cron_log (failed)', {
            error: e instanceof Error ? e.message : String(e)
        });
    }
}

export async function persistEventCompletionFromJob(job: Job): Promise<void> {
    if (!isDispatchEventJob(job)) return;
    try {
        await ensureDb();
        const repo = new EventLogRepositoryAdapter();
        const data = job.data as OutboxEvent | undefined;
        const finishedOn = job.finishedOn ?? Date.now();

        const entity = EventLog.create({
            id: Uuid(),
            type: data?.type ?? String(job.name ?? 'unknown'),
            recipient: inferRecipient(job),
            dispatchedAt: new Date(finishedOn),
            status: 'completed',
            payload: safePayload(job),
            errorMessage: null
        });
        await repo.save(entity);
    } catch (e) {
        log.warn('[Worker] Falha ao persistir event_log (completed)', {
            error: e instanceof Error ? e.message : String(e)
        });
    }
}

export async function persistEventFailureFromJob(job: Job | undefined, err: Error): Promise<void> {
    if (!job || !isDispatchEventJob(job)) return;
    try {
        await ensureDb();
        const repo = new EventLogRepositoryAdapter();
        const data = job.data as OutboxEvent | undefined;
        const finishedOn = job.finishedOn ?? Date.now();

        const entity = EventLog.create({
            id: Uuid(),
            type: data?.type ?? String(job.name ?? 'unknown'),
            recipient: inferRecipient(job),
            dispatchedAt: new Date(finishedOn),
            status: 'failed',
            payload: safePayload(job),
            errorMessage: formatErrorWithStack(err)
        });
        await repo.save(entity);
    } catch (e) {
        log.warn('[Worker] Falha ao persistir event_log (failed)', {
            error: e instanceof Error ? e.message : String(e)
        });
    }
}

