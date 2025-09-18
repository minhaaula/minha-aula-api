import { Queue } from 'bullmq';
import { OutboxRepository } from '../../../ports/repositories/outbox.repo';

export class OutboxProducer implements OutboxRepository {
    private queue = new Queue('outbox', {
        connection: { host: process.env.REDIS_HOST, port: +(process.env.REDIS_PORT ?? 6379) }
    });
    async enqueue(event: { type: string; payload: unknown; aggregateId: string }): Promise<void> {
        await this.queue.add(event.type, event, { removeOnComplete: true, attempts: 5, backoff: { type: 'exponential', delay: 1500 } });
    }
}
