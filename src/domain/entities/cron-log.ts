export type CronLogStatus = 'completed' | 'failed';

export class CronLog {
    private constructor(
        public readonly id: string,
        public readonly cronName: string,
        public readonly startedAt: Date,
        public readonly finishedAt: Date,
        public readonly status: CronLogStatus,
        public readonly errorMessage: string | null
    ) {}

    static create(params: {
        id: string;
        cronName: string;
        startedAt: Date;
        finishedAt: Date;
        status: CronLogStatus;
        errorMessage?: string | null;
    }): CronLog {
        const cronName = params.cronName.trim();
        if (!cronName) throw new Error('cronName is required');

        return new CronLog(
            params.id,
            cronName,
            params.startedAt,
            params.finishedAt,
            params.status,
            params.errorMessage ?? null
        );
    }
}

