import 'dotenv/config';
import { Queue } from 'bullmq';

const connection = {
    host: process.env.REDIS_HOST,
    port: +(process.env.REDIS_PORT ?? 6379),
    ...(process.env.REDIS_USER ? { username: process.env.REDIS_USER } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

async function schedulePaymentSyncJob() {
    if (!process.env.REDIS_HOST) {
        console.error('[Schedule] REDIS_HOST não configurado. Job não será agendado.');
        process.exit(1);
    }

    const queue = new Queue('outbox', { connection });

    // Verificar se já existe um job agendado
    const repeatableJobs = await queue.getRepeatableJobs();
    const existingJob = repeatableJobs.find(job => job.name === 'sync_payment_status');
    
    if (existingJob) {
        console.log('[Schedule] Job sync_payment_status já está agendado:', existingJob);
        await queue.close();
        return;
    }

    // Agendar job para executar a cada 15 minutos
    // Padrão cron: "*/15 * * * *" = a cada 15 minutos
    await queue.add(
        'sync_payment_status',
        { type: 'sync_payment_status', payload: { limit: 50, daysAgo: 7 }, aggregateId: 'payment-sync-scheduler' },
        {
            repeat: {
                pattern: '*/15 * * * *', // A cada 15 minutos
                tz: 'America/Sao_Paulo'
            },
            removeOnComplete: true,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000
            }
        }
    );

    console.log('[Schedule] Job sync_payment_status agendado para executar a cada 15 minutos');
    await queue.close();
}

schedulePaymentSyncJob().catch((error) => {
    console.error('[Schedule] Erro ao agendar job:', error);
    process.exit(1);
});
