export type EventLogStatus = 'completed' | 'failed';

export class EventLog {
    private constructor(
        public readonly id: string,
        public readonly type: string,
        public readonly recipient: string | null,
        public readonly dispatchedAt: Date,
        public readonly status: EventLogStatus,
        public readonly payload: Record<string, unknown> | null,
        public readonly errorMessage: string | null
    ) {}

    static create(params: {
        id: string;
        type: string;
        recipient?: string | null;
        dispatchedAt: Date;
        status: EventLogStatus;
        payload?: Record<string, unknown> | null;
        errorMessage?: string | null;
    }): EventLog {
        const type = params.type.trim();
        if (!type) throw new Error('type is required');

        return new EventLog(
            params.id,
            type,
            params.recipient?.trim() || null,
            params.dispatchedAt,
            params.status,
            params.payload ?? null,
            params.errorMessage ?? null
        );
    }
}

