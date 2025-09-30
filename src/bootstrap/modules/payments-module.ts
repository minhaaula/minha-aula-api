import { ModuleBuildResult, ModuleSetupContext } from './types';
import { PaymentRepositoryAdapter } from '../../infra/db/typeorm/payment-repository.adap';
import { OutboxProducer } from '../../infra/messaging/bullmq/outbox-producer';
import { AsaasProvider } from '../../infra/providers/asaas/asaas-provider';
import { CreatePayment } from '../../app/use-cases/create-payment';
import { CapturePayment } from '../../app/use-cases/CapturePayment';
import { IssueBoleto } from '../../app/use-cases/issue-boleto';
import { paymentsRouter } from '../../infra/http/routes/payments.routes';

export type PaymentsModuleDeps = {
    paymentsRepo: PaymentRepositoryAdapter;
    outbox: OutboxProducer;
    asaasApiKey: string;
    asaasBaseUrl?: string;
};

export function buildPaymentsModule(deps: PaymentsModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
    if (!deps.asaasApiKey) {
        throw new Error('ASAAS_API_KEY is required when payments module is enabled');
    }

    const provider = new AsaasProvider({
        apiKey: deps.asaasApiKey,
        baseUrl: deps.asaasBaseUrl
    });

    const createPayment = new CreatePayment(deps.paymentsRepo, provider, deps.outbox);
    const capturePayment = new CapturePayment(deps.paymentsRepo, provider, deps.outbox);
    const issueBoleto = new IssueBoleto(provider);

    return {
        deps: {
            paymentsRouter,
            createPayment,
            capturePayment,
            issueBoleto
        },
        docFiles: ['payments.yaml']
    };
}
