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
import { RegisterUser } from './app/use-cases/register-user';
import { UserRepositoryAdapter } from './infra/db/typeorm/user-repository.adap';
import { ScryptPasswordHasher } from './infra/auth/scrypt-password-hasher';
import { LoginUser } from './app/use-cases/login-user';
import { HmacTokenProvider } from './infra/auth/hmac-token-provider';
import { authRouter } from './infra/http/routes/auth.routes';


(async () => {
    await AppDataSource.initialize();
    const payments = new PaymentRepositoryAdapter();
    const users = new UserRepositoryAdapter();
    const outbox = new OutboxProducer();
    const provider = new AsaasProvider({ apiKey: process.env.ASAAS_API_KEY!, baseUrl: process.env.ASAAS_BASE_URL });

    const createPayment = new CreatePayment(payments, provider, outbox);
    const capturePayment = new CapturePayment(payments, provider, outbox);
    const passwordHasher = new ScryptPasswordHasher();
    const tokenProvider = new HmacTokenProvider(process.env.AUTH_TOKEN_SECRET ?? '');
    const parsedTtl = Number(process.env.AUTH_TOKEN_TTL ?? 3600);
    const tokenTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 3600;
    const registerUser = new RegisterUser(users, passwordHasher);
    const loginUser = new LoginUser(users, passwordHasher, tokenProvider, tokenTtl);

    const app = makeServer({
        paymentsRouter,
        healthRouter,
        authRouter,
        createPayment,
        capturePayment,
        registerUser,
        loginUser
    });

    app.listen(process.env.PORT ?? 3000, () => console.log(`API on http://localhost:${process.env.PORT ?? 3000}`));
})();
