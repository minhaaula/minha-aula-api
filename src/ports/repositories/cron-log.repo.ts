import type { CronLog, CronLogStatus } from '../../domain/entities/cron-log';

export type CronLogListFilter = {
    cronName?: string;
    status?: CronLogStatus;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
};

export interface CronLogRepository {
    save(log: CronLog): Promise<void>;
    findLatestByCronName(cronName: string): Promise<CronLog | null>;
    list(filter: CronLogListFilter): Promise<{ items: CronLog[]; total: number }>;
}

