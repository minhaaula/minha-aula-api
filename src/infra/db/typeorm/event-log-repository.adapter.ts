import { SelectQueryBuilder } from 'typeorm';
import { EventLog } from '../../../domain/entities/event-log';
import { EventLogListFilter, EventLogRepository } from '../../../ports/repositories/event-log.repo';
import { AppDataSource } from './datasource';
import { EventLogOrm } from './entities/event-log.orm';

export class EventLogRepositoryAdapter implements EventLogRepository {
    private readonly repo = AppDataSource.getRepository(EventLogOrm);

    async save(log: EventLog): Promise<void> {
        const row = this.toOrm(log);
        await this.repo.save(row);
    }

    async findById(id: string): Promise<EventLog | null> {
        const row = await this.repo.findOne({ where: { id: id.trim() } });
        return row ? this.toDomain(row) : null;
    }

    async list(filter: EventLogListFilter): Promise<{ items: EventLog[]; total: number }> {
        const build = (): SelectQueryBuilder<EventLogOrm> => {
            const qb = this.repo.createQueryBuilder('e');
            if (filter.type?.trim()) {
                qb.andWhere('e.type = :type', { type: filter.type.trim() });
            }
            if (filter.status) {
                qb.andWhere('e.status = :status', { status: filter.status });
            }
            if (filter.from) {
                qb.andWhere('e.dispatchedAt >= :from', { from: filter.from });
            }
            if (filter.to) {
                qb.andWhere('e.dispatchedAt <= :to', { to: filter.to });
            }
            return qb;
        };

        const total = await build().getCount();
        const rows = await build()
            .orderBy('e.dispatchedAt', 'DESC')
            .skip(filter.offset)
            .take(filter.limit)
            .getMany();
        return { items: rows.map((r) => this.toDomain(r)), total };
    }

    private toDomain(row: EventLogOrm): EventLog {
        return EventLog.create({
            id: row.id,
            type: row.type,
            recipient: row.recipient,
            dispatchedAt: row.dispatchedAt,
            status: row.status,
            payload: row.payload,
            errorMessage: row.errorMessage
        });
    }

    private toOrm(log: EventLog): EventLogOrm {
        const row = new EventLogOrm();
        row.id = log.id;
        row.type = log.type;
        row.recipient = log.recipient;
        row.dispatchedAt = log.dispatchedAt;
        row.status = log.status;
        row.payload = log.payload;
        row.errorMessage = log.errorMessage;
        return row;
    }
}

