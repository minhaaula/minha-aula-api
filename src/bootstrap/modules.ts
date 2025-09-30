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
import { OutboxProducer } from '../infra/messaging/bullmq/outbox-producer';
import { ScryptPasswordHasher } from '../infra/auth/scrypt-password-hasher';
import { HmacTokenProvider } from '../infra/auth/hmac-token-provider';
import { BASE_DOC_FILES, MODULES_ORDER, type ModuleName } from './module-config';
import { buildAuthModule } from './modules/auth-module';
import { buildPaymentsModule } from './modules/payments-module';
import { buildSchoolsModule } from './modules/schools-module';
import { buildStudentsModule } from './modules/students-module';
import { ModuleSetupContext, ModuleBuildResult } from './modules/types';

export type { ModuleName } from './module-config';

export function resolveModules(modules: ModuleName[]): ModuleName[] {
    const initial = modules.length > 0 ? modules : MODULES_ORDER;
    const set = new Set<ModuleName>(initial);
    const requiresAuth = set.has('schools') || set.has('students');
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
    const dependentsRepo = new DependentRepositoryAdapter();
    const enrollmentsRepo = new EnrollmentRepositoryAdapter();
    const enrollmentRequestsRepo = new EnrollmentRequestRepositoryAdapter();
    const outbox = new OutboxProducer();

    const passwordHasher = new ScryptPasswordHasher();
    const tokenProvider = new HmacTokenProvider(process.env.AUTH_TOKEN_SECRET ?? '');
    const parsedTtl = Number(process.env.AUTH_TOKEN_TTL ?? 3600);
    const tokenTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 3600;
    const authMiddleware = makeAuthMiddleware(tokenProvider);

    const serverDeps: Record<string, unknown> = {
        healthRouter,
        authMiddleware
    };

    const docFiles = new Set<string>(BASE_DOC_FILES);
    const ctx: ModuleSetupContext = { authMiddleware };

    for (const moduleName of selected) {
        switch (moduleName) {
            case 'auth': {
                const result = buildAuthModule({ usersRepo, passwordHasher, tokenProvider, tokenTtl }, ctx);
                mergeModuleResult(serverDeps, docFiles, result);
                break;
            }
            case 'payments': {
                const result = buildPaymentsModule({
                    paymentsRepo,
                    outbox,
                    asaasApiKey: process.env.ASAAS_API_KEY ?? '',
                    asaasBaseUrl: process.env.ASAAS_BASE_URL
                }, ctx);
                mergeModuleResult(serverDeps, docFiles, result);
                break;
            }
            case 'schools': {
                const result = buildSchoolsModule({ schoolsRepo, coursesRepo, classesRepo }, ctx);
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
