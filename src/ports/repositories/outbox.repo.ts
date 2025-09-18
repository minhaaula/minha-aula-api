export interface OutboxRepository {
    enqueue(event: { type: string; payload: unknown; aggregateId: string }): Promise<void>;
}
