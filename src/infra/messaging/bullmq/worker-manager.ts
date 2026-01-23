/**
 * Gerenciador do Worker BullMQ
 * Inicializa e gerencia o worker que processa jobs da fila
 */

import { Worker } from 'bullmq';
import { AppDataSource } from '../../db/typeorm/datasource';
import { PushTokenRepositoryAdapter } from '../../db/typeorm/push-token-repository.adapter';
import { sendFcmMulticast } from '../../providers/firebase/fcm-provider';
import { log } from '../../../shared/logger';

const connection = {
    host: process.env.REDIS_HOST,
    port: +(process.env.REDIS_PORT ?? 6379),
    ...(process.env.REDIS_USER ? { username: process.env.REDIS_USER } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

type OutboxEvent = { type: string; payload: any; aggregateId: string };

let workerInstance: Worker | null = null;

async function ensureDb() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/**
 * Inicializa o worker BullMQ para processar jobs da fila
 */
export function startWorker(): Worker {
    if (workerInstance) {
        log.warn('[Worker Manager] Worker já está em execução');
        return workerInstance;
    }

    if (!process.env.REDIS_HOST) {
        log.warn('[Worker Manager] REDIS_HOST não configurado. Worker não será iniciado.');
        throw new Error('REDIS_HOST não configurado');
    }

    log.info('[Worker Manager] Iniciando worker BullMQ...');

    workerInstance = new Worker(
        'outbox',
        async (job) => {
            const event = job.data as OutboxEvent;
            // Log detalhado para diagnóstico
            log.info('[OUTBOX] Processando job', { 
                name: job.name, 
                id: job.id,
                aggregateId: event?.aggregateId,
                type: event?.type,
                payload: event?.payload,
                opts: job.opts
            });

            // Verificar também pelo tipo do evento (fallback)
            const jobType = event?.type || job.name;

            if (job.name === 'push_notification' || jobType === 'push_notification') {
                await ensureDb();
                const tokensRepo = new PushTokenRepositoryAdapter();

                const userIds = Array.isArray(event.payload?.userIds) ? event.payload.userIds : [];
                const title = String(event.payload?.title ?? '').trim();
                const body = String(event.payload?.body ?? '').trim();
                const data = event.payload?.data && typeof event.payload.data === 'object' ? event.payload.data : undefined;
                if (!userIds.length || !title || !body) {
                    log.warn('[OUTBOX] push_notification payload inválido', { userIdsCount: userIds.length, hasTitle: !!title, hasBody: !!body });
                    return;
                }

                const active = await tokensRepo.listActiveByUserIds(userIds);
                const tokens = active.map((t) => t.token);
                if (!tokens.length) {
                    log.info('[OUTBOX] push_notification: sem tokens', { userIds: userIds.length });
                    return;
                }

                // FCM suporta até 500 tokens por multicast
                const invalid: string[] = [];
                let successCount = 0;
                let failureCount = 0;
                for (const group of chunk(tokens, 500)) {
                    const res = await sendFcmMulticast({ tokens: group, title, body, data });
                    successCount += res.successCount;
                    failureCount += res.failureCount;
                    invalid.push(...res.invalidTokens);
                }

                if (invalid.length) {
                    await tokensRepo.revokeByTokens(invalid);
                }

                log.info('[OUTBOX] push_notification sent', { successCount, failureCount, invalid: invalid.length });
                return;
            }

            if (job.name === 'fetch_payment_receipts' || jobType === 'fetch_payment_receipts') {
                log.info('[OUTBOX] Iniciando processamento de fetch_payment_receipts');
                await ensureDb();
                
                const { SchoolPlanInvoiceRepositoryAdapter } = await import('../../db/typeorm/school-plan-invoice-repository.adapter.js');
                const { SchoolPlanFinanceRepositoryAdapter } = await import('../../db/typeorm/school-plan-finance-repository.adapter.js');
                const { SchoolRepositoryAdapter } = await import('../../db/typeorm/school-repository.js');
                const { AsaasProvider } = await import('../../providers/asaas/asaas-provider.js');
                const { FetchPaymentReceipts } = await import('../../../app/use-cases/fetch-payment-receipts.js');

                const invoicesRepo = new SchoolPlanInvoiceRepositoryAdapter();
                const financesRepo = new SchoolPlanFinanceRepositoryAdapter();
                const schoolsRepo = new SchoolRepositoryAdapter();

                const asaasApiKey = process.env.ASAAS_API_KEY;
                const asaasBaseUrl = process.env.ASAAS_BASE_URL;
                const asaasProviderInstance = asaasApiKey ? new AsaasProvider({ apiKey: asaasApiKey, baseUrl: asaasBaseUrl }) : undefined;
                const asaasProvider = asaasProviderInstance && typeof asaasProviderInstance.getPayment === 'function'
                    ? asaasProviderInstance as any
                    : undefined;

                const fetchReceipts = new FetchPaymentReceipts(
                    invoicesRepo,
                    financesRepo,
                    schoolsRepo,
                    asaasProvider
                );

                const limit = typeof event.payload?.limit === 'number' ? event.payload.limit : 50;
                const result = await fetchReceipts.exec({ limit });

                log.info('[OUTBOX] fetch_payment_receipts completed', result);
                return;
            }

            if (job.name === 'sync_payment_status' || jobType === 'sync_payment_status') {
                log.info('[OUTBOX] Iniciando processamento de sync_payment_status');
                await ensureDb();
                
                const { SchoolPlanInvoiceRepositoryAdapter } = await import('../../db/typeorm/school-plan-invoice-repository.adapter.js');
                const { SchoolPlanFinanceRepositoryAdapter } = await import('../../db/typeorm/school-plan-finance-repository.adapter.js');
                const { SchoolRepositoryAdapter } = await import('../../db/typeorm/school-repository.js');
                const { AsaasProvider } = await import('../../providers/asaas/asaas-provider.js');
                const { SyncPaymentStatus } = await import('../../../app/use-cases/sync-payment-status.js');

                const invoicesRepo = new SchoolPlanInvoiceRepositoryAdapter();
                const financesRepo = new SchoolPlanFinanceRepositoryAdapter();
                const schoolsRepo = new SchoolRepositoryAdapter();

                const asaasApiKey = process.env.ASAAS_API_KEY;
                const asaasBaseUrl = process.env.ASAAS_BASE_URL;
                const asaasProviderInstance = asaasApiKey ? new AsaasProvider({ apiKey: asaasApiKey, baseUrl: asaasBaseUrl }) : undefined;
                const asaasProvider = asaasProviderInstance && typeof asaasProviderInstance.getPayment === 'function'
                    ? asaasProviderInstance as any
                    : undefined;

                const syncStatus = new SyncPaymentStatus(
                    invoicesRepo,
                    financesRepo,
                    schoolsRepo,
                    asaasProvider
                );

                const limit = typeof event.payload?.limit === 'number' ? event.payload.limit : 50;
                const daysAgo = typeof event.payload?.daysAgo === 'number' ? event.payload.daysAgo : 7;
                const result = await syncStatus.exec({ limit, daysAgo });

                log.info('[OUTBOX] sync_payment_status completed', result);
                return;
            }

            // default: manter comportamento atual (log)
            log.warn('[OUTBOX] unhandled event', { name: job.name, payload: event.payload });
        },
        { 
            connection,
            concurrency: 5, // Processar até 5 jobs simultaneamente
            limiter: {
                max: 10,
                duration: 1000
            }
        }
    );

    workerInstance.on('completed', (job) => {
        log.info('[Worker] Job completado', { name: job.name, id: job.id, data: job.data });
    });

    workerInstance.on('failed', (job, err) => {
        log.error('[Worker] Job falhou', { 
            name: job?.name, 
            id: job?.id,
            data: job?.data,
            error: err.message,
            stack: err.stack,
            attemptsMade: job?.attemptsMade
        });
    });

    workerInstance.on('error', (err) => {
        log.error('[Worker] Erro no worker', { error: err.message, stack: err.stack });
    });

    workerInstance.on('active', (job) => {
        log.info('[Worker] Job ativo', { name: job.name, id: job.id });
    });

    workerInstance.on('stalled', (jobId) => {
        log.warn('[Worker] Job travado', { jobId });
    });

    log.info('[Worker Manager] Worker BullMQ iniciado com sucesso');
    return workerInstance;
}

/**
 * Para o worker
 */
export async function stopWorker(): Promise<void> {
    if (workerInstance) {
        log.info('[Worker Manager] Parando worker...');
        await workerInstance.close();
        workerInstance = null;
        log.info('[Worker Manager] Worker parado');
    }
}

/**
 * Verifica se o worker está rodando
 */
export function isWorkerRunning(): boolean {
    return workerInstance !== null;
}
