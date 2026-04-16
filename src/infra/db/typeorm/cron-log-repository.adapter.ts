import { SelectQueryBuilder } from 'typeorm';
import { CronLog } from '../../../domain/entities/cron-log';
import { CronLogListFilter, CronLogRepository } from '../../../ports/repositories/cron-log.repo';
import { AppDataSource } from './datasource';
import { CronLogOrm } from './entities/cron-log.orm';

export class CronLogRepositoryAdapter implements CronLogRepository {
    private readonly repo = AppDataSource.getRepository(CronLogOrm);

    async save(log: CronLog): Promise<void> {
        const row = this.toOrm(log);
        await this.repo.save(row);
    }

    async findLatestByCronName(cronName: string): Promise<CronLog | null> {
        const name = cronName.trim();
        if (!name) return null;
        const row = await this.repo.findOne({
            where: { cronName: name },
            order: { finishedAt: 'DESC' }
        });
        return row ? this.toDomain(row) : null;
    }

    async list(filter: CronLogListFilter): Promise<{ items: CronLog[]; total: number }> {
        const build = (): SelectQueryBuilder<CronLogOrm> => {
            const qb = this.repo.createQueryBuilder('c');
            if (filter.cronName?.trim()) {
                qb.andWhere('c.cronName = :cronName', { cronName: filter.cronName.trim() });
            }
            if (filter.status) {
                qb.andWhere('c.status = :status', { status: filter.status });
            }
            if (filter.from) {
                qb.andWhere('c.finishedAt >= :from', { from: filter.from });
            }
            if (filter.to) {
                qb.andWhere('c.finishedAt <= :to', { to: filter.to });
            }
            return qb;
        };

        const total = await build().getCount();
        const rows = await build()
            .orderBy('c.finishedAt', 'DESC')
            .skip(filter.offset)
            .take(filter.limit)
            .getMany();
        return { items: rows.map((r) => this.toDomain(r)), total };
    }

    private toDomain(row: CronLogOrm): CronLog {
        return CronLog.create({
            id: row.id,
            cronName: row.cronName,
            startedAt: row.startedAt,
            finishedAt: row.finishedAt,
            status: row.status,
            errorMessage: row.errorMessage
        });
    }

    private toOrm(log: CronLog): CronLogOrm {
        const row = new CronLogOrm();
        row.id = log.id;
        row.cronName = log.cronName;
        row.startedAt = log.startedAt;
        row.finishedAt = log.finishedAt;
        row.status = log.status;
        row.errorMessage = log.errorMessage;
        return row;
    }
}

