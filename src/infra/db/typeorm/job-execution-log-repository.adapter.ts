import { SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from './datasource';
import { JobExecutionLog } from '../../../domain/entities/job-execution-log';
import {
    JobExecutionLogListFilter,
    JobExecutionLogRepository,
    JobExecutionLogSummaryFilter
} from '../../../ports/repositories/job-execution-log.repo';
import { JobExecutionLogOrm } from './entities/job-execution-log.orm';

export class JobExecutionLogRepositoryAdapter implements JobExecutionLogRepository {
    private readonly repo = AppDataSource.getRepository(JobExecutionLogOrm);

    async save(log: JobExecutionLog): Promise<void> {
        const row = this.toOrm(log);
        await this.repo.save(row);
    }

    async findById(id: string): Promise<JobExecutionLog | null> {
        const row = await this.repo.findOne({ where: { id: id.trim() } });
        return row ? this.toDomain(row) : null;
    }

    async list(filter: JobExecutionLogListFilter): Promise<{ items: JobExecutionLog[]; total: number }> {
        const build = (): SelectQueryBuilder<JobExecutionLogOrm> => {
            const qb = this.repo.createQueryBuilder('j');
            if (filter.status) {
                qb.andWhere('j.status = :status', { status: filter.status });
            }
            if (filter.jobName?.trim()) {
                qb.andWhere('j.jobName = :jobName', { jobName: filter.jobName.trim() });
            }
            if (filter.from) {
                qb.andWhere('j.finishedAt >= :from', { from: filter.from });
            }
            if (filter.to) {
                qb.andWhere('j.finishedAt <= :to', { to: filter.to });
            }
            return qb;
        };

        const total = await build().getCount();
        const rows = await build().orderBy('j.finishedAt', 'DESC').skip(filter.offset).take(filter.limit).getMany();
        return { items: rows.map((r) => this.toDomain(r)), total };
    }

    async countByStatus(filter: JobExecutionLogSummaryFilter): Promise<{ completed: number; failed: number }> {
        const qb = this.repo.createQueryBuilder('j');
        if (filter.jobName?.trim()) {
            qb.andWhere('j.jobName = :jobName', { jobName: filter.jobName.trim() });
        }
        if (filter.from) {
            qb.andWhere('j.finishedAt >= :from', { from: filter.from });
        }
        if (filter.to) {
            qb.andWhere('j.finishedAt <= :to', { to: filter.to });
        }

        const raw = await qb
            .select('j.status', 'status')
            .addSelect('COUNT(*)', 'cnt')
            .groupBy('j.status')
            .getRawMany<{ status: string; cnt: string }>();

        let completed = 0;
        let failed = 0;
        for (const r of raw) {
            const n = parseInt(r.cnt, 10) || 0;
            if (r.status === 'completed') completed = n;
            if (r.status === 'failed') failed = n;
        }
        return { completed, failed };
    }

    private toDomain(row: JobExecutionLogOrm): JobExecutionLog {
        return JobExecutionLog.create({
            id: row.id,
            status: row.status,
            jobName: row.jobName,
            outboxType: row.outboxType,
            aggregateId: row.aggregateId,
            bullmqJobId: row.bullmqJobId,
            attemptsMade: row.attemptsMade,
            processedAt: row.processedAt,
            finishedAt: row.finishedAt,
            durationMs: row.durationMs,
            errorMessage: row.errorMessage,
            errorStack: row.errorStack,
            resultSummary: row.resultSummary
        });
    }

    private toOrm(log: JobExecutionLog): JobExecutionLogOrm {
        const row = new JobExecutionLogOrm();
        row.id = log.id;
        row.status = log.status;
        row.jobName = log.jobName;
        row.outboxType = log.outboxType;
        row.aggregateId = log.aggregateId;
        row.bullmqJobId = log.bullmqJobId;
        row.attemptsMade = log.attemptsMade;
        row.processedAt = log.processedAt;
        row.finishedAt = log.finishedAt;
        row.durationMs = log.durationMs;
        row.errorMessage = log.errorMessage;
        row.errorStack = log.errorStack;
        row.resultSummary = log.resultSummary;
        return row;
    }
}
