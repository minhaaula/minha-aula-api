import 'dotenv/config';
import { AppDataSource } from './infra/db/typeorm/datasource';
import { OutboxProducer } from './infra/messaging/bullmq/outbox-producer';
import { AsaasProvider } from './infra/providers/asaas/asaas-provider';
import { CapturePayment } from './app/use-cases/CapturePayment';
import { makeServer } from './infra/http/express-server';
import { paymentsRouter } from './infra/http/routes/payments.routes';
import { healthRouter } from './infra/http/routes/health.routes';
import { PaymentRepositoryAdapter } from './infra/db/typeorm/payment-repository.adap';
import { CreatePayment } from './app/use-cases/create-payment';


(async () => {
    await AppDataSource.initialize();
    const payments = new PaymentRepositoryAdapter();
    const outbox = new OutboxProducer();
    const provider = new AsaasProvider({ apiKey: process.env.ASAAS_API_KEY!, baseUrl: process.env.ASAAS_BASE_URL });

    const createPayment = new CreatePayment(payments, provider, outbox);
    const capturePayment = new CapturePayment(payments, provider, outbox);

    const app = makeServer({
        paymentsRouter,
        healthRouter,
        createPayment,
        capturePayment
    });

    app.listen(process.env.PORT ?? 3000, () => console.log(`API on http://localhost:${process.env.PORT ?? 3000}`));
})();
