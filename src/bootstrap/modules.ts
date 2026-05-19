import { AppDataSource } from '../infra/db/typeorm/datasource';
import { makeServer } from '../infra/http/express-server';
import { healthRouter } from '../infra/http/routes/health.routes';
import { makeAuthMiddleware } from '../infra/http/middlewares/auth';
import { PaymentRepositoryAdapter } from '../infra/db/typeorm/payment-repository.adapter';
import { UserRepositoryAdapter } from '../infra/db/typeorm/user-repository.adapter';
import { SchoolRepositoryAdapter } from '../infra/db/typeorm/school-repository';
import { CourseRepositoryAdapter } from '../infra/db/typeorm/course-repository';
import { CourseClassRepositoryAdapter } from '../infra/db/typeorm/course-class-repository.adapter';
import { DependentRepositoryAdapter } from '../infra/db/typeorm/dependent-repository.adapter';
import { SchoolFinancialChargeRepositoryAdapter } from '../infra/db/typeorm/school-financial-charge-repository.adapter';
import { ChargeDueReminderRepositoryAdapter } from '../infra/db/typeorm/charge-due-reminder-repository.adapter';
import { EnrollmentRepositoryAdapter } from '../infra/db/typeorm/enrollment-repository';
import { EnrollmentRequestRepositoryAdapter } from '../infra/db/typeorm/enrollment-request-repository.adapter';
import { ClassSessionRepositoryAdapter } from '../infra/db/typeorm/class-session-repository.adapter';
import { SchoolPlanFinanceRepositoryAdapter } from '../infra/db/typeorm/school-plan-finance-repository.adapter';
import { SchoolPlanInvoiceRepositoryAdapter } from '../infra/db/typeorm/school-plan-invoice-repository.adapter';
import { SubscriptionPlanRepositoryAdapter } from '../infra/db/typeorm/subscription-plan-repository.adapter';
import { CategoryRepositoryAdapter } from '../infra/db/typeorm/category-repository.adapter';
import { SchoolBankAccountRepositoryAdapter } from '../infra/db/typeorm/school-bank-account-repository.adapter';
import { SchoolReviewRepositoryAdapter } from '../infra/db/typeorm/school-review-repository.adapter';
import { NotificationRepositoryAdapter } from '../infra/db/typeorm/notification-repository.adapter';
import { PushTokenRepositoryAdapter } from '../infra/db/typeorm/push-token-repository.adapter';
import { OutboxProducer } from '../infra/messaging/bullmq/outbox-producer';
import { ScryptPasswordHasher } from '../infra/auth/scrypt-password-hasher';
import { HmacTokenProvider } from '../infra/auth/hmac-token-provider';
import { BASE_DOC_FILES, MODULES_ORDER, type ModuleName } from './module-config';
import { buildAuthModule } from './modules/auth-module';
import { buildAdminModule } from './modules/admin-module';
import { buildPaymentsModule } from './modules/payments-module';
import { buildSchoolsModule } from './modules/schools-module';
import { buildStudentsModule } from './modules/students-module';
import { ModuleSetupContext, ModuleBuildResult } from './modules/types';
import { ListCategories } from '../app/use-cases/list-categories';
import { NotifyStudentUser } from '../app/use-cases/notify-student-user';
import { Router } from 'express';
import { asyncHandler } from '../infra/http/utils/async-handler';
import { AsaasProvider } from '../infra/providers/asaas/asaas-provider';
import { PaymentProviderPort } from '../ports/providers/payment-provider.port';
import { AsaasProviderPort } from '../ports/providers/asaas-port';
import { NodemailerEmailProvider } from '../infra/providers/nodemailer/email-provider';
import { TwilioSendGridEmailProvider } from '../infra/providers/twilio/email-provider';
import { MailchimpEmailProvider } from '../infra/providers/mailchimp/email-provider';
import { EmailProviderPort } from '../ports/providers/email-provider.port';
import { S3StorageProvider } from '../infra/providers/s3/storage-provider';
import { StorageProviderPort } from '../ports/providers/storage-provider.port';

type ServerDeps = Parameters<typeof makeServer>[0];

export type { ModuleName } from './module-config';

export function resolveModules(modules: ModuleName[]): ModuleName[] {
    const initial = modules.length > 0 ? modules : MODULES_ORDER;
    const set = new Set<ModuleName>(initial);
    const requiresAuth = (['students', 'admin'] as ModuleName[]).some((module) => set.has(module));
    if (requiresAuth) {
        set.add('auth');
    }
    return MODULES_ORDER.filter((module) => set.has(module));
}

export function validateAsaasWebhookTokenConfig(params: {
    selected: ModuleName[];
    nodeEnv?: string;
    asaasWebhookToken?: string;
    asaasSubaccountWebhookAuthToken?: string;
    authTokenSecret: string;
}) {
    const isProduction = params.nodeEnv === 'production';
    const schoolsModuleActive = params.selected.includes('schools');
    const asaasWebhookToken = params.asaasWebhookToken?.trim();
    const asaasSubaccountWebhookAuthToken = params.asaasSubaccountWebhookAuthToken?.trim();
    const authTokenSecret = params.authTokenSecret.trim();

    if (!schoolsModuleActive) {
        return;
    }

    // Em produção precisa de pelo menos um token (master OU subconta).
    // Aceitar qualquer um dos dois é importante porque webhooks de subcontas usam um token próprio.
    if (isProduction && !asaasWebhookToken && !asaasSubaccountWebhookAuthToken) {
        throw new Error('ASAAS_WEBHOOK_TOKEN é obrigatório em produção quando o módulo schools está ativo (webhooks Asaas)');
    }

    // CRÍTICO: nenhum dos tokens pode ser igual ao AUTH_TOKEN_SECRET.
    if (asaasWebhookToken && asaasWebhookToken === authTokenSecret) {
        throw new Error(
            'CRITICAL SECURITY ERROR: ASAAS_WEBHOOK_TOKEN não pode ser igual a AUTH_TOKEN_SECRET. Use tokens diferentes para webhooks e autenticação de usuários.'
        );
    }
    if (asaasSubaccountWebhookAuthToken && asaasSubaccountWebhookAuthToken === authTokenSecret) {
        throw new Error(
            'CRITICAL SECURITY ERROR: ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN não pode ser igual a AUTH_TOKEN_SECRET.'
        );
    }
}

function mergeModuleResult(target: Record<string, unknown>, docs: Set<string>, result: ModuleBuildResult | undefined) {
    if (!result) return;
    Object.assign(target, result.deps);
    if (result.docFiles) {
        result.docFiles.forEach((file) => docs.add(file));
    }
}

export async function createServerForModules(modules: ModuleName[]): Promise<{ app: import('express').Application; modules: ModuleName[] }> {
    const selected = resolveModules(modules);

    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }

    const paymentsRepo = new PaymentRepositoryAdapter();
    const usersRepo = new UserRepositoryAdapter();
    const schoolsRepo = new SchoolRepositoryAdapter();
    const coursesRepo = new CourseRepositoryAdapter();
    const classesRepo = new CourseClassRepositoryAdapter();
    const schoolPlanFinancesRepo = new SchoolPlanFinanceRepositoryAdapter();
    const schoolPlanInvoicesRepo = new SchoolPlanInvoiceRepositoryAdapter();
    const subscriptionPlansRepo = new SubscriptionPlanRepositoryAdapter();
    const categoriesRepo = new CategoryRepositoryAdapter();
    const dependentsRepo = new DependentRepositoryAdapter();
    const financialChargesRepo = new SchoolFinancialChargeRepositoryAdapter();
    const bankAccountsRepo = new SchoolBankAccountRepositoryAdapter();
    const classSessionsRepo = new ClassSessionRepositoryAdapter();
    const enrollmentsRepo = new EnrollmentRepositoryAdapter();
    const enrollmentRequestsRepo = new EnrollmentRequestRepositoryAdapter();
    const schoolReviewsRepo = new SchoolReviewRepositoryAdapter();
    const notificationsRepo = new NotificationRepositoryAdapter();
    const pushTokensRepo = new PushTokenRepositoryAdapter();
    const outbox = new OutboxProducer();
    const chargeDueReminderRepoForAdmin = new ChargeDueReminderRepositoryAdapter();

    // Status de integrações (filas e push) — apenas logs informativos
    {
        const redisHost = process.env.REDIS_HOST;
        const redisPort = process.env.REDIS_PORT ?? '6379';
        const queuesConfigured = Boolean(redisHost);
        const usesOutbox = selected.includes('payments') || selected.includes('schools') || selected.includes('students');

        if (usesOutbox) {
            if (queuesConfigured) {
                console.log(`[Queue] BullMQ/outbox configurado (REDIS_HOST=${redisHost}, REDIS_PORT=${redisPort}). Para processar jobs, rode também: npm run worker`);
            } else {
                console.warn('[Queue] BullMQ/outbox NÃO configurado (REDIS_HOST ausente). Jobs assíncronos (ex: push) não serão processados.');
            }
        }

        const fcmRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!fcmRaw) {
            console.warn('[Push] FCM NÃO configurado (FIREBASE_SERVICE_ACCOUNT_JSON ausente). Push notifications não serão enviadas.');
        } else {
            try {
                const parsed = JSON.parse(fcmRaw);
                const ok = parsed && typeof parsed === 'object' && typeof parsed.project_id === 'string';
                if (ok) {
                    console.log(`[Push] FCM configurado (project_id=${parsed.project_id}).`);
                } else {
                    console.warn('[Push] FCM configurado, mas FIREBASE_SERVICE_ACCOUNT_JSON não parece um service account válido (project_id ausente).');
                }
            } catch {
                console.warn('[Push] FCM configurado, mas FIREBASE_SERVICE_ACCOUNT_JSON não é um JSON válido.');
            }
        }
    }

    // Validar AUTH_TOKEN_SECRET obrigatório
    const authTokenSecret = process.env.AUTH_TOKEN_SECRET?.trim();
    if (!authTokenSecret || authTokenSecret.length < 32) {
        throw new Error('AUTH_TOKEN_SECRET é obrigatório e deve ter pelo menos 32 caracteres para segurança adequada');
    }

    // Validar tokens de webhook do Asaas (master e subconta) apenas quando o módulo schools está ativo.
    validateAsaasWebhookTokenConfig({
        selected,
        nodeEnv: process.env.NODE_ENV,
        asaasWebhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
        asaasSubaccountWebhookAuthToken: process.env.ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN,
        authTokenSecret
    });

    const passwordHasher = new ScryptPasswordHasher();
    const tokenProvider = new HmacTokenProvider(authTokenSecret);
    /** Access token: STUDENT (auth) e SCHOOL — padrão 24h. */
    const AUTH_TOKEN_TTL_STUDENT_SCHOOL_SECONDS = 24 * 60 * 60;
    const parsedClientTtl = Number(process.env.AUTH_TOKEN_TTL ?? AUTH_TOKEN_TTL_STUDENT_SCHOOL_SECONDS);
    const clientTokenTtl =
        Number.isFinite(parsedClientTtl) && parsedClientTtl > 0
            ? parsedClientTtl
            : AUTH_TOKEN_TTL_STUDENT_SCHOOL_SECONDS;
    /** Access token ADMIN — padrão 1h (independente do app aluno/escola). */
    const parsedAdminTtl = Number(process.env.ADMIN_AUTH_TOKEN_TTL ?? 3600);
    const adminTokenTtl =
        Number.isFinite(parsedAdminTtl) && parsedAdminTtl > 0 ? parsedAdminTtl : 3600;
    const authMiddleware = makeAuthMiddleware(tokenProvider);

    // Configurar email provider
    // Prioridade: Mailchimp > Twilio SendGrid > Nodemailer
    let emailProvider: EmailProviderPort | undefined;
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL;

    // Tentar configurar Mailchimp primeiro
    const mailchimpApiKey = process.env.MAILCHIMP_API_KEY;
    const mailchimpFrom = process.env.MAILCHIMP_FROM_EMAIL;

    if (mailchimpApiKey && mailchimpFrom) {
        try {
            emailProvider = new MailchimpEmailProvider({
                apiKey: mailchimpApiKey,
                from: mailchimpFrom,
                fromName: process.env.MAILCHIMP_FROM_NAME
            });
            console.log('EmailProvider configurado com sucesso: Mailchimp', { from: mailchimpFrom });
        } catch (error) {
            console.error('Erro ao configurar Mailchimp EmailProvider:', error);
            // Fallback para SendGrid se Mailchimp falhar
        }
    }

    // Fallback para Twilio SendGrid se Mailchimp não estiver configurado
    if (!emailProvider) {
        const sendgridApiKey = process.env.SENDGRID_API_KEY;
        const sendgridFrom = process.env.SENDGRID_FROM_EMAIL;

        if (sendgridApiKey && sendgridFrom) {
            try {
                emailProvider = new TwilioSendGridEmailProvider({
                    apiKey: sendgridApiKey,
                    from: sendgridFrom,
                    fromName: process.env.SENDGRID_FROM_NAME
                });
                console.log('EmailProvider configurado com sucesso: Twilio SendGrid', { from: sendgridFrom });
            } catch (error) {
                console.error('Erro ao configurar Twilio SendGrid EmailProvider:', error);
                // Fallback para Nodemailer se SendGrid falhar
            }
        }
    }

    // Fallback para Nodemailer se Mailchimp e SendGrid não estiverem configurados
    if (!emailProvider) {
        const emailHost = process.env.EMAIL_HOST;
        const emailPort = process.env.EMAIL_PORT;
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;

        if (emailHost && emailPort && emailUser && emailPass) {
            try {
                emailProvider = new NodemailerEmailProvider({
                    host: emailHost,
                    port: Number(emailPort),
                    auth: {
                        user: emailUser,
                        pass: emailPass
                    },
                    from: process.env.EMAIL_FROM
                });
                console.log('EmailProvider configurado com sucesso: Nodemailer', { host: emailHost, port: emailPort });
            } catch (error) {
                console.error('Erro ao configurar Nodemailer EmailProvider:', error);
            }
        }
    }

    if (!emailProvider) {
        console.warn('EmailProvider não configurado. Configure uma das opções:');
        console.warn('  - Mailchimp: MAILCHIMP_API_KEY, MAILCHIMP_FROM_EMAIL');
        console.warn('  - Twilio SendGrid: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL');
        console.warn('  - Nodemailer: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS');
    }

    // Configurar storage provider (Railway Storage)
    let storageProvider: StorageProviderPort | undefined;
    const storageAccessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const storageSecretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    const storageRegion = process.env.STORAGE_REGION;
    const storageBucket = process.env.STORAGE_BUCKET;
    const storageEndpoint = process.env.STORAGE_ENDPOINT;

    if (storageAccessKeyId && storageSecretAccessKey && storageRegion && storageBucket) {
        try {
            storageProvider = new S3StorageProvider({
                accessKeyId: storageAccessKeyId,
                secretAccessKey: storageSecretAccessKey,
                region: storageRegion,
                bucket: storageBucket,
                endpoint: storageEndpoint,
                forcePathStyle: true
            });
            console.log('StorageProvider configurado com sucesso:', { 
                bucket: storageBucket, 
                endpoint: storageEndpoint || 'default S3 endpoint' 
            });
        } catch (error) {
            console.error('Erro ao configurar StorageProvider:', error);
        }
    } else {
        console.warn('StorageProvider não configurado. Variáveis necessárias: STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_REGION, STORAGE_BUCKET');
    }

    const serverDeps: ServerDeps = {
        healthRouter,
        authMiddleware
    };

    const docFiles = new Set<string>(BASE_DOC_FILES);
    const ctx: ModuleSetupContext = { authMiddleware };

    const asaasApiKey = process.env.ASAAS_API_KEY ?? '';
    const asaasBaseUrl = process.env.ASAAS_BASE_URL;
    const needsPaymentProvider = selected.includes('payments') || selected.includes('schools') || selected.includes('students') || selected.includes('admin');

    let paymentProvider: (PaymentProviderPort & Partial<AsaasProviderPort>) | undefined;
    if (needsPaymentProvider) {
        if (!asaasApiKey) {
            throw new Error('ASAAS_API_KEY is required when payments, schools, students or admin module is enabled');
        }
        paymentProvider = new AsaasProvider({ apiKey: asaasApiKey, baseUrl: asaasBaseUrl });
    }

    for (const moduleName of selected) {
        switch (moduleName) {
            case 'auth': {
                const notifyStudentAuth =
                    notificationsRepo && outbox ? new NotifyStudentUser(notificationsRepo, outbox) : undefined;
                const result = buildAuthModule({
                    usersRepo,
                    passwordHasher,
                    tokenProvider,
                    tokenTtl: clientTokenTtl,
                    activeModules: selected,
                    schoolsRepo,
                    emailProvider,
                    outbox,
                    frontendBaseUrl,
                    notifyStudent: notifyStudentAuth
                }, ctx);
                mergeModuleResult(serverDeps, docFiles, result);
                break;
            }
            case 'admin': {
                const asaasProviderForAdmin = typeof paymentProvider?.createSubAccount === 'function'
                    ? paymentProvider as AsaasProviderPort
                    : undefined;
                const result = buildAdminModule({
                    getActiveModules: () => selected,
                    getOpenApiFiles: () => Array.from(docFiles),
                    getEnvironmentInfo: () => ({
                        nodeEnv: process.env.NODE_ENV ?? null,
                        appModulesEnv: process.env.APP_MODULES ?? null
                    }),
                    schoolsRepo,
                    planFinancesRepo: schoolPlanFinancesRepo,
                    planInvoicesRepo: schoolPlanInvoicesRepo,
                    enrollmentRequestsRepo,
                    subscriptionPlansRepo,
                    categoriesRepo,
                    usersRepo,
                    coursesRepo,
                    classesRepo,
                    enrollmentsRepo,
                    dependentsRepo,
                    financialChargesRepo,
                    outbox,
                    chargeDueReminderRepo: chargeDueReminderRepoForAdmin,
                    passwordHasher,
                    tokenProvider,
                    tokenTtl: adminTokenTtl,
                    asaasProvider: asaasProviderForAdmin,
                    notificationsRepo
                }, ctx);
                mergeModuleResult(serverDeps, docFiles, result);
                break;
            }
            case 'payments': {
                if (!paymentProvider) {
                    throw new Error('Payment provider is not configured');
                }
                const result = buildPaymentsModule({
                    paymentsRepo,
                    outbox,
                    paymentProvider
                }, ctx);
                mergeModuleResult(serverDeps, docFiles, result);
                break;
            }
            case 'schools': {
                if (!paymentProvider) {
                    throw new Error('Payment provider is not configured');
                }
                const result = buildSchoolsModule({
                    schoolsRepo,
                    coursesRepo,
                    classesRepo,
                    usersRepo,
                    dependentsRepo,
                    enrollmentsRepo,
                    enrollmentRequestsRepo,
                    subscriptionPlansRepo,
                    categoriesRepo,
                    planFinancesRepo: schoolPlanFinancesRepo,
                    planInvoicesRepo: schoolPlanInvoicesRepo,
                    classSessionsRepo,
                    passwordHasher,
                    tokenProvider,
                    tokenTtl: clientTokenTtl,
                    paymentProvider,
                    financialChargesRepo,
                    bankAccountsRepo,
                    emailProvider,
                    outbox,
                    frontendBaseUrl,
                    storageProvider,
                    notificationsRepo
                }, ctx);
                mergeModuleResult(serverDeps, docFiles, result);
                break;
            }
            case 'students': {
                if (!paymentProvider) {
                    throw new Error('Payment provider is not configured');
                }
                const result = buildStudentsModule({
                    usersRepo,
                    dependentsRepo,
                    schoolsRepo,
                    coursesRepo,
                    classesRepo,
                    enrollmentsRepo,
                    enrollmentRequestsRepo,
                    financialChargesRepo,
                    paymentProvider,
                    categoriesRepo,
                    schoolReviewsRepo,
                    storageProvider,
                    notificationsRepo,
                    pushTokensRepo,
                    outbox,
                    frontendBaseUrl
                }, ctx);
                mergeModuleResult(serverDeps, docFiles, result);
                break;
            }
        }
    }

    serverDeps.activeModules = selected;
    serverDeps.openapiFiles = Array.from(docFiles);

    // Quando só o módulo students está ativo, montar rota pública GET /schools/categories
    // para o app de estudantes (evita 404 em https://.../schools/categories)
    if (selected.includes('students') && !selected.includes('schools')) {
        const listCategories = new ListCategories(categoriesRepo);
        const schoolsPublicRouter = Router();
        schoolsPublicRouter.get('/categories', asyncHandler(async (_req, res) => {
            const result = await listCategories.exec();
            res.json(result);
        }));
        serverDeps.schoolsRouter = schoolsPublicRouter;
    }

    return { app: makeServer(serverDeps), modules: selected };
}
