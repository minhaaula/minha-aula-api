import 'dotenv/config';
import { Worker } from 'bullmq';
import { AppDataSource } from '../../db/typeorm/datasource';
import { PushTokenRepositoryAdapter } from '../../db/typeorm/push-token-repository.adapter';
import { sendFcmMulticast } from '../../providers/firebase/fcm-provider';

const connection = {
    host: process.env.REDIS_HOST,
    port: +(process.env.REDIS_PORT ?? 6379),
    ...(process.env.REDIS_USER ? { username: process.env.REDIS_USER } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

type OutboxEvent = { type: string; payload: any; aggregateId: string };

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

new Worker(
    'outbox',
    async (job) => {
        const event = job.data as OutboxEvent;
        console.log('[OUTBOX]', job.name, event.aggregateId);

        if (job.name === 'push_notification') {
            await ensureDb();
            const tokensRepo = new PushTokenRepositoryAdapter();

            const userIds = Array.isArray(event.payload?.userIds) ? event.payload.userIds : [];
            const title = String(event.payload?.title ?? '').trim();
            const body = String(event.payload?.body ?? '').trim();
            const data = event.payload?.data && typeof event.payload.data === 'object' ? event.payload.data : undefined;
            if (!userIds.length || !title || !body) {
                console.warn('[OUTBOX] push_notification payload inválido', { userIdsCount: userIds.length, hasTitle: !!title, hasBody: !!body });
                return;
            }

            const active = await tokensRepo.listActiveByUserIds(userIds);
            const tokens = active.map((t) => t.token);
            if (!tokens.length) {
                console.log('[OUTBOX] push_notification: sem tokens', { userIds: userIds.length });
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

            console.log('[OUTBOX] push_notification sent', { successCount, failureCount, invalid: invalid.length });
            return;
        }

        if (job.name === 'fetch_payment_receipts') {
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

            console.log('[OUTBOX] fetch_payment_receipts completed', result);
            return;
        }

        if (job.name === 'sync_payment_status') {
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

            console.log('[OUTBOX] sync_payment_status completed', result);
            return;
        }

        // default: manter comportamento atual (log)
        console.log('[OUTBOX] unhandled event', job.name, event.payload);
    },
    { connection }
);
