import { Worker } from 'bullmq';

new Worker('outbox', async job => {
    console.log('[OUTBOX]', job.name, job.data);
}, { connection: { host: process.env.REDIS_HOST, port: +(process.env.REDIS_PORT ?? 6379) } });
