import { Worker } from 'bullmq';

const connection = {
    host: process.env.REDIS_HOST,
    port: +(process.env.REDIS_PORT ?? 6379),
    ...(process.env.REDIS_USER ? { username: process.env.REDIS_USER } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

new Worker('outbox', async job => {
    console.log('[OUTBOX]', job.name, job.data);
}, { connection });
