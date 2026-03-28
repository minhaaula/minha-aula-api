import { describe, it, expect } from 'vitest';
import { JobExecutionLog } from '../../src/domain/entities/job-execution-log';
import {
    JobExecutionLogListFilter,
    JobExecutionLogRepository,
    JobExecutionLogSummaryFilter
} from '../../src/ports/repositories/job-execution-log.repo';
import { ListAdminJobLogs } from '../../src/app/use-cases/list-admin-job-logs';
import { Uuid } from '../../src/shared/uuid';

class InMemoryJobExecutionLogRepository implements JobExecutionLogRepository {
    private readonly items: JobExecutionLog[] = [];

    async save(log: JobExecutionLog): Promise<void> {
        this.items.push(log);
    }

    async findById(id: string): Promise<JobExecutionLog | null> {
        return this.items.find((x) => x.id === id) ?? null;
    }

    async list(filter: JobExecutionLogListFilter): Promise<{ items: JobExecutionLog[]; total: number }> {
        let rows = [...this.items];
        if (filter.status) rows = rows.filter((r) => r.status === filter.status);
        if (filter.jobName?.trim()) rows = rows.filter((r) => r.jobName === filter.jobName.trim());
        if (filter.from) rows = rows.filter((r) => r.finishedAt >= filter.from!);
        if (filter.to) rows = rows.filter((r) => r.finishedAt <= filter.to!);
        rows.sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());
        const total = rows.length;
        const page = rows.slice(filter.offset, filter.offset + filter.limit);
        return { items: page, total };
    }

    async countByStatus(filter: JobExecutionLogSummaryFilter): Promise<{ completed: number; failed: number }> {
        let rows = [...this.items];
        if (filter.jobName?.trim()) rows = rows.filter((r) => r.jobName === filter.jobName.trim());
        if (filter.from) rows = rows.filter((r) => r.finishedAt >= filter.from!);
        if (filter.to) rows = rows.filter((r) => r.finishedAt <= filter.to!);
        return {
            completed: rows.filter((r) => r.status === 'completed').length,
            failed: rows.filter((r) => r.status === 'failed').length
        };
    }
}

describe('ListAdminJobLogs', () => {
    it('lista com summary e paginação', async () => {
        const repo = new InMemoryJobExecutionLogRepository();
        const t0 = new Date('2026-01-10T12:00:00.000Z');
        await repo.save(
            JobExecutionLog.create({
                id: Uuid(),
                status: 'completed',
                jobName: 'push_notification',
                finishedAt: t0,
                resultSummary: { ok: true }
            })
        );
        await repo.save(
            JobExecutionLog.create({
                id: Uuid(),
                status: 'failed',
                jobName: 'fetch_payment_receipts',
                finishedAt: new Date('2026-01-10T13:00:00.000Z'),
                errorMessage: 'boom'
            })
        );

        const uc = new ListAdminJobLogs(repo);
        const out = await uc.exec({ limit: 10, offset: 0 });

        expect(out.total).toBe(2);
        expect(out.summary.completed).toBe(1);
        expect(out.summary.failed).toBe(1);
        expect(out.items[0].status).toBe('failed');
    });

    it('rejeita intervalo de datas inválido', async () => {
        const uc = new ListAdminJobLogs(new InMemoryJobExecutionLogRepository());
        await expect(
            uc.exec({
                from: new Date('2026-02-01'),
                to: new Date('2026-01-01')
            })
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
});
