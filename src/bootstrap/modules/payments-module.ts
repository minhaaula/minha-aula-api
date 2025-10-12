import { ModuleBuildResult, ModuleSetupContext } from './types';
import { PaymentRepositoryAdapter } from '../../infra/db/typeorm/payment-repository.adap';
import { OutboxProducer } from '../../infra/messaging/bullmq/outbox-producer';
import { CreatePayment } from '../../app/use-cases/create-payment';
import { CapturePayment } from '../../app/use-cases/CapturePayment';
import { IssueBoleto } from '../../app/use-cases/issue-boleto';
import { paymentsRouter } from '../../infra/http/routes/payments.routes';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';

export type PaymentsModuleDeps = {
    paymentsRepo: PaymentRepositoryAdapter;
    outbox: OutboxProducer;
    paymentProvider: PaymentProviderPort;
};

export function buildPaymentsModule(deps: PaymentsModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
    if (!deps.paymentProvider) {
        throw new Error('A payment provider instance is required when payments module is enabled');
    }

    const provider = deps.paymentProvider;

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
