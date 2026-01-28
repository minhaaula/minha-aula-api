import 'dotenv/config';
import { schedulePaymentSyncJob } from './job-scheduler';

// Script standalone para agendar job de sincronização de pagamentos
schedulePaymentSyncJob().catch((error) => {
    console.error('[Schedule] Erro ao agendar job:', error);
    process.exit(1);
});
