import 'dotenv/config';
import { Queue } from 'bullmq';

const connection = {
    host: process.env.REDIS_HOST,
    port: +(process.env.REDIS_PORT ?? 6379),
    ...(process.env.REDIS_USER ? { username: process.env.REDIS_USER } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

async function scheduleReceiptsJob() {
    if (!process.env.REDIS_HOST) {
        console.error('[Schedule] REDIS_HOST não configurado. Job não será agendado.');
        process.exit(1);
    }

    const queue = new Queue('outbox', { connection });

    // Verificar se já existe um job agendado
    const repeatableJobs = await queue.getRepeatableJobs();
    const existingJob = repeatableJobs.find(job => job.name === 'fetch_payment_receipts');
    
    if (existingJob) {
        console.log('[Schedule] Job fetch_payment_receipts já está agendado:', existingJob);
        await queue.close();
        return;
    }

    // Agendar job para executar a cada 30 minutos
    // Padrão cron: "*/30 * * * *" = a cada 30 minutos
    await queue.add(
        'fetch_payment_receipts',
        { type: 'fetch_payment_receipts', payload: { limit: 50 }, aggregateId: 'receipts-scheduler' },
        {
            repeat: {
                pattern: '*/30 * * * *', // A cada 30 minutos
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

    console.log('[Schedule] Job fetch_payment_receipts agendado para executar a cada 30 minutos');
    await queue.close();
}

scheduleReceiptsJob().catch((error) => {
    console.error('[Schedule] Erro ao agendar job:', error);
    process.exit(1);
});
