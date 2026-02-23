import { Queue } from 'bullmq';
import { OutboxRepository } from '../../../ports/repositories/outbox.repo';
import { connection, getOutboxQueueName } from './queue-config';

export class OutboxProducer implements OutboxRepository {
    private queue = new Queue(getOutboxQueueName(), { connection });
    async enqueue(event: { type: string; payload: unknown; aggregateId: string }): Promise<void> {
        await this.queue.add(event.type, event, { removeOnComplete: true, attempts: 5, backoff: { type: 'exponential', delay: 1500 } });
    }
}
