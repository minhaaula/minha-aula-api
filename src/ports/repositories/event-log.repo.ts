import type { EventLog, EventLogStatus } from '../../domain/entities/event-log';

export type EventLogListFilter = {
    type?: string;
    status?: EventLogStatus;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
};

export interface EventLogRepository {
    save(log: EventLog): Promise<void>;
    findById(id: string): Promise<EventLog | null>;
    list(filter: EventLogListFilter): Promise<{ items: EventLog[]; total: number }>;
}

