/**
 * Agendador de jobs para BullMQ
 * Centraliza a lógica de agendamento de jobs repetitivos
 */

import { Queue } from 'bullmq';
import { log } from '../../../shared/logger';
import { connection, getOutboxQueueName } from './queue-config';

/**
 * Agenda o job de busca de recibos de pagamento
 */
export async function scheduleReceiptsJob(): Promise<void> {
    if (!process.env.REDIS_HOST) {
        log.warn('[Job Scheduler] REDIS_HOST não configurado. Job fetch_payment_receipts não será agendado.');
        return;
    }

    try {
        const queue = new Queue(getOutboxQueueName(), { connection });

        // Verificar se já existe um job agendado
        const repeatableJobs = await queue.getRepeatableJobs();
        const existingJob = repeatableJobs.find(job => job.name === 'fetch_payment_receipts');
        
        if (existingJob) {
            log.info('[Job Scheduler] Job fetch_payment_receipts já está agendado', {
                id: existingJob.id,
                pattern: existingJob.pattern,
                nextRun: existingJob.next
            });
            await queue.close();
            return;
        }

        // Executar imediatamente na primeira vez
        log.info('[Job Scheduler] Executando fetch_payment_receipts imediatamente...');
        await queue.add(
            'fetch_payment_receipts',
            { type: 'fetch_payment_receipts', payload: { limit: 50 }, aggregateId: 'receipts-scheduler-immediate' },
            {
                removeOnComplete: true,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            }
        );

        // Agendar para repetir a cada 30 minutos
        const addedJob = await queue.add(
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

        log.info('[Job Scheduler] Job fetch_payment_receipts agendado para executar a cada 30 minutos', {
            jobId: addedJob.id,
            repeatKey: addedJob.opts?.repeat?.key,
            pattern: addedJob.opts?.repeat?.pattern
        });
        await queue.close();
    } catch (error) {
        log.error('[Job Scheduler] Erro ao agendar job fetch_payment_receipts', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

/**
 * Agenda o job de sincronização de status de pagamento
 */
export async function schedulePaymentSyncJob(): Promise<void> {
    if (!process.env.REDIS_HOST) {
        log.warn('[Job Scheduler] REDIS_HOST não configurado. Job sync_payment_status não será agendado.');
        return;
    }

    try {
        const queue = new Queue(getOutboxQueueName(), { connection });

        // Verificar se já existe um job agendado
        const repeatableJobs = await queue.getRepeatableJobs();
        const existingJob = repeatableJobs.find(job => job.name === 'sync_payment_status');
        
        if (existingJob) {
            log.info('[Job Scheduler] Job sync_payment_status já está agendado', {
                id: existingJob.id,
                pattern: existingJob.pattern,
                nextRun: existingJob.next
            });
            await queue.close();
            return;
        }

        // Executar imediatamente na primeira vez
        log.info('[Job Scheduler] Executando sync_payment_status imediatamente...');
        await queue.add(
            'sync_payment_status',
            { type: 'sync_payment_status', payload: { limit: 50, daysAgo: 7 }, aggregateId: 'payment-sync-scheduler-immediate' },
            {
                removeOnComplete: true,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            }
        );

        // Agendar para repetir a cada 15 minutos
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

        log.info('[Job Scheduler] Job sync_payment_status agendado para executar a cada 15 minutos');
        await queue.close();
    } catch (error) {
        log.error('[Job Scheduler] Erro ao agendar job sync_payment_status', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

/**
 * Agenda o job que busca onboarding URL para escolas com account_api_key e sem onboarding_url (a cada 15 min).
 */
export async function scheduleFetchSchoolOnboardingJob(): Promise<void> {
    if (!process.env.REDIS_HOST) {
        log.warn('[Job Scheduler] REDIS_HOST não configurado. Job fetch_school_onboarding_url não será agendado.');
        return;
    }

    try {
        const queue = new Queue(getOutboxQueueName(), { connection });
        const desiredPattern = '*/2 * * * *';
        const repeatableJobs = await queue.getRepeatableJobs();
        const existingJob = repeatableJobs.find((job) => job.name === 'fetch_school_onboarding_url');

        if (existingJob) {
            if (existingJob.pattern === desiredPattern) {
                log.info('[Job Scheduler] Job fetch_school_onboarding_url já está agendado (a cada 2 min)', {
                    id: existingJob.id,
                    pattern: existingJob.pattern,
                    nextRun: existingJob.next
                });
                await queue.close();
                return;
            }
            await queue.removeRepeatableByKey(existingJob.key);
            log.info('[Job Scheduler] Job fetch_school_onboarding_url antigo removido (pattern anterior: ' + existingJob.pattern + '), reagendando com */2');
        }

        log.info('[Job Scheduler] Executando fetch_school_onboarding_url imediatamente...');
        await queue.add(
            'fetch_school_onboarding_url',
            { type: 'fetch_school_onboarding_url', payload: { limit: 50 }, aggregateId: 'fetch-school-onboarding-immediate' },
            { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
        );

        await queue.add(
            'fetch_school_onboarding_url',
            { type: 'fetch_school_onboarding_url', payload: { limit: 50 }, aggregateId: 'fetch-school-onboarding' },
            {
                repeat: { pattern: '*/2 * * * *', tz: 'America/Sao_Paulo' },
                removeOnComplete: true,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 }
            }
        );

        log.info('[Job Scheduler] Job fetch_school_onboarding_url agendado para executar a cada 2 minutos');
        await queue.close();
    } catch (error) {
        log.error('[Job Scheduler] Erro ao agendar job fetch_school_onboarding_url', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

const CHARGE_DUE_REMINDER_JOB_NAME = 'schedule_charge_due_reminders';

/**
 * Agenda o job de lembretes de vencimento (cobranças que vencem em até 10 dias).
 * Enfileira emails na fila; roda a cada 6 horas.
 */
export async function scheduleChargeDueRemindersJob(): Promise<void> {
    if (!process.env.REDIS_HOST) {
        log.warn('[Job Scheduler] REDIS_HOST não configurado. Job schedule_charge_due_reminders não será agendado.');
        return;
    }

    try {
        const queue = new Queue(getOutboxQueueName(), { connection });
        const repeatableJobs = await queue.getRepeatableJobs();
        const existingJob = repeatableJobs.find((job) => job.name === CHARGE_DUE_REMINDER_JOB_NAME);

        if (existingJob) {
            log.info('[Job Scheduler] Job schedule_charge_due_reminders já está agendado', {
                id: existingJob.id,
                pattern: existingJob.pattern,
                nextRun: existingJob.next
            });
            await queue.close();
            return;
        }

        log.info('[Job Scheduler] Executando schedule_charge_due_reminders imediatamente...');
        await queue.add(
            CHARGE_DUE_REMINDER_JOB_NAME,
            {
                type: CHARGE_DUE_REMINDER_JOB_NAME,
                payload: {},
                aggregateId: 'charge-due-reminders-scheduler-immediate'
            },
            { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
        );

        await queue.add(
            CHARGE_DUE_REMINDER_JOB_NAME,
            {
                type: CHARGE_DUE_REMINDER_JOB_NAME,
                payload: {},
                aggregateId: 'charge-due-reminders-scheduler'
            },
            {
                repeat: { pattern: '0 */6 * * *', tz: 'America/Sao_Paulo' },
                removeOnComplete: true,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 }
            }
        );

        log.info('[Job Scheduler] Job schedule_charge_due_reminders agendado para executar a cada 6 horas');
        await queue.close();
    } catch (error) {
        log.error('[Job Scheduler] Erro ao agendar job schedule_charge_due_reminders', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

const GENERATE_MONTHLY_CHARGES_JOB_NAME = 'generate_monthly_tuition_charges';

/**
 * Agenda o job de geração de cobranças mensais (mensalidades do próximo mês).
 * Roda a cada 5 minutos.
 */
export async function scheduleGenerateMonthlyChargesJob(): Promise<void> {
    if (!process.env.REDIS_HOST) {
        log.warn('[Job Scheduler] REDIS_HOST não configurado. Job generate_monthly_tuition_charges não será agendado.');
        return;
    }

    try {
        const queue = new Queue('outbox', { connection });
        const repeatableJobs = await queue.getRepeatableJobs();
        const existingJob = repeatableJobs.find((job) => job.name === GENERATE_MONTHLY_CHARGES_JOB_NAME);

        if (existingJob) {
            log.info('[Job Scheduler] Job generate_monthly_tuition_charges já está agendado', {
                id: existingJob.id,
                pattern: existingJob.pattern,
                nextRun: existingJob.next
            });
            await queue.close();
            return;
        }

        await queue.add(
            GENERATE_MONTHLY_CHARGES_JOB_NAME,
            {
                type: GENERATE_MONTHLY_CHARGES_JOB_NAME,
                payload: {},
                aggregateId: 'generate-monthly-charges-scheduler'
            },
            {
                repeat: { pattern: '*/5 * * * *', tz: 'America/Sao_Paulo' },
                removeOnComplete: true,
                attempts: 3,
                backoff: { type: 'exponential', delay: 60000 }
            }
        );

        log.info('[Job Scheduler] Job generate_monthly_tuition_charges agendado para executar a cada 5 minutos');
        await queue.close();
    } catch (error) {
        log.error('[Job Scheduler] Erro ao agendar job generate_monthly_tuition_charges', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

const SEND_BOLETO_NOTIFICATIONS_JOB_NAME = 'send_boleto_notifications';

/**
 * Agenda o job de envio de notificações de boletos (e-mail para boletos criados nas últimas 24h).
 * Roda uma vez por dia às 09:00 (America/Sao_Paulo).
 */
export async function scheduleBoletoNotificationsJob(): Promise<void> {
    if (!process.env.REDIS_HOST) {
        log.warn('[Job Scheduler] REDIS_HOST não configurado. Job send_boleto_notifications não será agendado.');
        return;
    }

    try {
        const queue = new Queue('outbox', { connection });
        const repeatableJobs = await queue.getRepeatableJobs();
        const existingJob = repeatableJobs.find((job) => job.name === SEND_BOLETO_NOTIFICATIONS_JOB_NAME);

        if (existingJob) {
            log.info('[Job Scheduler] Job send_boleto_notifications já está agendado', {
                id: existingJob.id,
                pattern: existingJob.pattern,
                nextRun: existingJob.next
            });
            await queue.close();
            return;
        }

        await queue.add(
            SEND_BOLETO_NOTIFICATIONS_JOB_NAME,
            {
                type: SEND_BOLETO_NOTIFICATIONS_JOB_NAME,
                payload: {},
                aggregateId: 'send-boleto-notifications-scheduler'
            },
            {
                repeat: { pattern: '0 9 * * *', tz: 'America/Sao_Paulo' },
                removeOnComplete: true,
                attempts: 3,
                backoff: { type: 'exponential', delay: 60000 }
            }
        );

        log.info('[Job Scheduler] Job send_boleto_notifications agendado para executar diariamente às 09:00');
        await queue.close();
    } catch (error) {
        log.error('[Job Scheduler] Erro ao agendar job send_boleto_notifications', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

/**
 * Agenda todos os jobs repetitivos
 */
export async function scheduleAllJobs(): Promise<void> {
    log.info('[Job Scheduler] Iniciando agendamento de jobs...');

    await Promise.all([
        scheduleReceiptsJob(),
        schedulePaymentSyncJob(),
        scheduleFetchSchoolOnboardingJob(),
        scheduleChargeDueRemindersJob(),
        scheduleGenerateMonthlyChargesJob(),
        scheduleBoletoNotificationsJob()
    ]);

    log.info('[Job Scheduler] Todos os jobs foram agendados com sucesso');
}
