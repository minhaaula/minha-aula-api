import 'dotenv/config';
import { scheduleReceiptsJob } from './job-scheduler';

// Script standalone para agendar job de recibos
scheduleReceiptsJob().catch((error) => {
    console.error('[Schedule] Erro ao agendar job:', error);
    process.exit(1);
});
