import { AppDataSource } from '../infra/db/typeorm/datasource';
import { makeServer } from '../infra/http/express-server';
import { healthRouter } from '../infra/http/routes/health.routes';
import { makeAuthMiddleware } from '../infra/http/middlewares/auth';
import { PaymentRepositoryAdapter } from '../infra/db/typeorm/payment-repository.adap';
import { UserRepositoryAdapter } from '../infra/db/typeorm/user-repository.adap';
import { SchoolRepositoryAdapter } from '../infra/db/typeorm/school-repository.adap';
import { CourseRepositoryAdapter } from '../infra/db/typeorm/course-repository.adap';
import { CourseClassRepositoryAdapter } from '../infra/db/typeorm/course-class-repository.adap';
import { DependentRepositoryAdapter } from '../infra/db/typeorm/dependent-repository.adap';
import { EnrollmentRepositoryAdapter } from '../infra/db/typeorm/enrollment-repository.adap';
import { EnrollmentRequestRepositoryAdapter } from '../infra/db/typeorm/enrollment-request-repository.adap';
import { ClassSessionRepositoryAdapter } from '../infra/db/typeorm/class-session-repository.adap';
import { SchoolPlanFinanceRepositoryAdapter } from '../infra/db/typeorm/school-plan-finance-repository.adap';
import { SchoolPlanInvoiceRepositoryAdapter } from '../infra/db/typeorm/school-plan-invoice-repository.adap';
import { SubscriptionPlanRepositoryAdapter } from '../infra/db/typeorm/subscription-plan-repository.adap';
import { CategoryRepositoryAdapter } from '../infra/db/typeorm/category-repository.adap';
import { OutboxProducer } from '../infra/messaging/bullmq/outbox-producer';
import { ScryptPasswordHasher } from '../infra/auth/scrypt-password-hasher';
import { HmacTokenProvider } from '../infra/auth/hmac-token-provider';
import { BASE_DOC_FILES, MODULES_ORDER, type ModuleName } from './module-config';
import { buildAuthModule } from './modules/auth-module';
import { buildPaymentsModule } from './modules/payments-module';
import { buildSchoolsModule } from './modules/schools-module';
import { buildStudentsModule } from './modules/students-module';
import { ModuleSetupContext, ModuleBuildResult } from './modules/types';
import { AsaasProvider } from '../infra/providers/asaas/asaas-provider';
import { PaymentProviderPort } from '../ports/providers/payment-provider.port';
import { AsaasProviderPort } from '../ports/providers/asaas-port';

type ServerDeps = Parameters<typeof makeServer>[0];

export type { ModuleName } from './module-config';

export function resolveModules(modules: ModuleName[]): ModuleName[] {
    const initial = modules.length > 0 ? modules : MODULES_ORDER;
    const set = new Set<ModuleName>(initial);
    const requiresAuth = set.has('students');
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
    const classSessionsRepo = new ClassSessionRepositoryAdapter();
    const enrollmentsRepo = new EnrollmentRepositoryAdapter();
    const enrollmentRequestsRepo = new EnrollmentRequestRepositoryAdapter();
    const outbox = new OutboxProducer();

    const passwordHasher = new ScryptPasswordHasher();
    const tokenProvider = new HmacTokenProvider(process.env.AUTH_TOKEN_SECRET ?? '');
    const parsedTtl = Number(process.env.AUTH_TOKEN_TTL ?? 3600);
    const tokenTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 3600;
    const authMiddleware = makeAuthMiddleware(tokenProvider);

    const serverDeps: ServerDeps = {
        healthRouter,
        authMiddleware
    };

    const docFiles = new Set<string>(BASE_DOC_FILES);
    const ctx: ModuleSetupContext = { authMiddleware };

    const asaasApiKey = process.env.ASAAS_API_KEY ?? '';
    const asaasBaseUrl = process.env.ASAAS_BASE_URL;
    const needsPaymentProvider = selected.includes('payments') || selected.includes('schools');

    let paymentProvider: (PaymentProviderPort & Partial<AsaasProviderPort>) | undefined;
    if (needsPaymentProvider) {
        if (!asaasApiKey) {
            throw new Error('ASAAS_API_KEY is required when payments or schools module is enabled');
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
                    schoolsRepo
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
                    paymentProvider
                }, ctx);
                mergeModuleResult(serverDeps, docFiles, result);
                break;
            }
            case 'students': {
                const result = buildStudentsModule({
                    usersRepo,
                    dependentsRepo,
                    schoolsRepo,
                    coursesRepo,
                    classesRepo,
                    enrollmentsRepo,
                    enrollmentRequestsRepo
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
