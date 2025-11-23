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
import { EnrollmentRepositoryAdapter } from '../infra/db/typeorm/enrollment-repository';
import { EnrollmentRequestRepositoryAdapter } from '../infra/db/typeorm/enrollment-request-repository.adapter';
import { ClassSessionRepositoryAdapter } from '../infra/db/typeorm/class-session-repository.adapter';
import { SchoolPlanFinanceRepositoryAdapter } from '../infra/db/typeorm/school-plan-finance-repository.adapter';
import { SchoolPlanInvoiceRepositoryAdapter } from '../infra/db/typeorm/school-plan-invoice-repository.adapter';
import { SubscriptionPlanRepositoryAdapter } from '../infra/db/typeorm/subscription-plan-repository.adapter';
import { CategoryRepositoryAdapter } from '../infra/db/typeorm/category-repository.adapter';
import { SchoolBankAccountRepositoryAdapter } from '../infra/db/typeorm/school-bank-account-repository.adapter';
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
import { AsaasProvider } from '../infra/providers/asaas/asaas-provider';
import { PaymentProviderPort } from '../ports/providers/payment-provider.port';
import { AsaasProviderPort } from '../ports/providers/asaas-port';
import { NodemailerEmailProvider } from '../infra/providers/nodemailer/email-provider';
import { EmailProviderPort } from '../ports/providers/email-provider.port';

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
    const outbox = new OutboxProducer();

    const passwordHasher = new ScryptPasswordHasher();
    const tokenProvider = new HmacTokenProvider(process.env.AUTH_TOKEN_SECRET ?? '');
    const parsedTtl = Number(process.env.AUTH_TOKEN_TTL ?? 3600);
    const tokenTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 3600;
    const authMiddleware = makeAuthMiddleware(tokenProvider);

    // Configurar email provider
    let emailProvider: EmailProviderPort | undefined;
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL;

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
            console.log('EmailProvider configurado com sucesso:', { host: emailHost, port: emailPort });
        } catch (error) {
            console.error('Erro ao configurar EmailProvider:', error);
        }
    } else {
        console.warn('EmailProvider não configurado. Variáveis necessárias: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS');
    }

    const serverDeps: ServerDeps = {
        healthRouter,
        authMiddleware
    };

    const docFiles = new Set<string>(BASE_DOC_FILES);
    const ctx: ModuleSetupContext = { authMiddleware };

    const asaasApiKey = process.env.ASAAS_API_KEY ?? '';
    const asaasBaseUrl = process.env.ASAAS_BASE_URL;
    const needsPaymentProvider = selected.includes('payments') || selected.includes('schools') || selected.includes('students');

    let paymentProvider: (PaymentProviderPort & Partial<AsaasProviderPort>) | undefined;
    if (needsPaymentProvider) {
        if (!asaasApiKey) {
            throw new Error('ASAAS_API_KEY is required when payments, schools or students module is enabled');
        }
        paymentProvider = new AsaasProvider({ apiKey: asaasApiKey, baseUrl: asaasBaseUrl });
    }

    for (const moduleName of selected) {
        switch (moduleName) {
            case 'auth': {
                const result = buildAuthModule({
                    usersRepo,
                    passwordHasher,
                    tokenProvider,
                    tokenTtl,
                    activeModules: selected,
                    schoolsRepo,
                    emailProvider,
                    frontendBaseUrl
                }, ctx);
                mergeModuleResult(serverDeps, docFiles, result);
                break;
            }
            case 'admin': {
                const result = buildAdminModule({
                    getActiveModules: () => selected,
                    getOpenApiFiles: () => Array.from(docFiles),
                    getEnvironmentInfo: () => ({
                        nodeEnv: process.env.NODE_ENV ?? null,
                        appModulesEnv: process.env.APP_MODULES ?? null
                    }),
                    schoolsRepo,
                    planFinancesRepo: schoolPlanFinancesRepo,
                    usersRepo,
                    classesRepo,
                    enrollmentsRepo,
                    financialChargesRepo,
                    passwordHasher,
                    tokenProvider,
                    tokenTtl
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
                    tokenTtl,
                    paymentProvider,
                    financialChargesRepo,
                    bankAccountsRepo,
                    emailProvider,
                    frontendBaseUrl
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
                    categoriesRepo
                }, ctx);
                mergeModuleResult(serverDeps, docFiles, result);
                break;
            }
        }
    }

    serverDeps.activeModules = selected;
    serverDeps.openapiFiles = Array.from(docFiles);

    return { app: makeServer(serverDeps), modules: selected };
}
