import { AppDataSource } from '../infra/db/typeorm/datasource';
import { makeServer } from '../infra/http/express-server';
import { authRouter } from '../infra/http/routes/auth.routes';
import { paymentsRouter } from '../infra/http/routes/payments.routes';
import { healthRouter } from '../infra/http/routes/health.routes';
import { schoolsRouter } from '../infra/http/routes/schools.routes';
import { dependentsRouter } from '../infra/http/routes/dependents.routes';
import { enrollmentRequestsRouter } from '../infra/http/routes/enrollment-requests.routes';
import { RegisterUser } from '../app/use-cases/register-user';
import { LoginUser } from '../app/use-cases/login-user';
import { CreatePayment } from '../app/use-cases/create-payment';
import { CapturePayment } from '../app/use-cases/CapturePayment';
import { CreateSchool } from '../app/use-cases/create-school';
import { CreateCourse } from '../app/use-cases/create-course';
import { CreateCourseClass } from '../app/use-cases/create-course-class';
import { AddDependent } from '../app/use-cases/add-dependent';
import { CreateEnrollmentRequest } from '../app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from '../app/use-cases/approve-enrollment-request';
import { PaymentRepositoryAdapter } from '../infra/db/typeorm/payment-repository.adap';
import { OutboxProducer } from '../infra/messaging/bullmq/outbox-producer';
import { AsaasProvider } from '../infra/providers/asaas/asaas-provider';
import { SchoolRepositoryAdapter } from '../infra/db/typeorm/school-repository.adap';
import { CourseRepositoryAdapter } from '../infra/db/typeorm/course-repository.adap';
import { CourseClassRepositoryAdapter } from '../infra/db/typeorm/course-class-repository.adap';
import { DependentRepositoryAdapter } from '../infra/db/typeorm/dependent-repository.adap';
import { EnrollmentRepositoryAdapter } from '../infra/db/typeorm/enrollment-repository.adap';
import { EnrollmentRequestRepositoryAdapter } from '../infra/db/typeorm/enrollment-request-repository.adap';
import { UserRepositoryAdapter } from '../infra/db/typeorm/user-repository.adap';
import { ScryptPasswordHasher } from '../infra/auth/scrypt-password-hasher';
import { HmacTokenProvider } from '../infra/auth/hmac-token-provider';
import { makeAuthMiddleware } from '../infra/http/middlewares/auth';

export type ModuleName = 'auth' | 'payments' | 'schools' | 'students';

const DEFAULT_MODULES: ModuleName[] = ['auth', 'payments', 'schools', 'students'];

export async function createServerForModules(modules: ModuleName[]): Promise<import('express').Application> {
    const selected = modules.length > 0 ? Array.from(new Set(modules)) : DEFAULT_MODULES;

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

    const passwordHasher = new ScryptPasswordHasher();
    const tokenProvider = new HmacTokenProvider(process.env.AUTH_TOKEN_SECRET ?? '');
    const parsedTtl = Number(process.env.AUTH_TOKEN_TTL ?? 3600);
    const tokenTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 3600;
    const authMiddleware = makeAuthMiddleware(tokenProvider);

    const serverDeps: any = {
        healthRouter,
        authMiddleware
    };

    const needsAuth = selected.some((module) => ['payments', 'students', 'schools'].includes(module));
    const includeAuth = selected.includes('auth') || needsAuth || selected.length === 0;
    const includePayments = selected.includes('payments');
    const includeSchools = selected.includes('schools');
    const includeStudents = selected.includes('students');

    if (includeAuth) {
        const registerUser = new RegisterUser(usersRepo, passwordHasher);
        const loginUser = new LoginUser(usersRepo, passwordHasher, tokenProvider, tokenTtl);
        serverDeps.authRouter = authRouter;
        serverDeps.registerUser = registerUser;
        serverDeps.loginUser = loginUser;
    }

    if (includePayments) {
        const outbox = new OutboxProducer();
        const provider = new AsaasProvider({
            apiKey: process.env.ASAAS_API_KEY!,
            baseUrl: process.env.ASAAS_BASE_URL
        });
        const createPayment = new CreatePayment(paymentsRepo, provider, outbox);
        const capturePayment = new CapturePayment(paymentsRepo, provider, outbox);
        serverDeps.paymentsRouter = paymentsRouter;
        serverDeps.createPayment = createPayment;
        serverDeps.capturePayment = capturePayment;
    }

    if (includeSchools) {
        const registerUser = new RegisterUser(usersRepo, passwordHasher);
        const loginUser = new LoginUser(usersRepo, passwordHasher, tokenProvider, tokenTtl);
        serverDeps.authRouter = authRouter;
        serverDeps.registerUser = registerUser;
        serverDeps.loginUser = loginUser;

        const createSchool = new CreateSchool(schoolsRepo);
        const createCourse = new CreateCourse(schoolsRepo, coursesRepo);
        const createCourseClass = new CreateCourseClass(coursesRepo, classesRepo);
        serverDeps.schoolsRouter = schoolsRouter;
        serverDeps.createSchool = createSchool;
        serverDeps.createCourse = createCourse;
        serverDeps.createCourseClass = createCourseClass;
    }

    if (includeStudents) {
        const registerUser = new RegisterUser(usersRepo, passwordHasher);
        const loginUser = new LoginUser(usersRepo, passwordHasher, tokenProvider, tokenTtl);
        serverDeps.authRouter = authRouter;
        serverDeps.registerUser = registerUser;
        serverDeps.loginUser = loginUser;
        
        const addDependent = new AddDependent(usersRepo, dependentsRepo);
        const createEnrollmentRequest = new CreateEnrollmentRequest(
            schoolsRepo,
            coursesRepo,
            classesRepo,
            usersRepo,
            dependentsRepo,
            enrollmentsRepo,
            enrollmentRequestsRepo
        );
        const approveEnrollmentRequest = new ApproveEnrollmentRequest(enrollmentRequestsRepo, enrollmentsRepo);
        serverDeps.dependentsRouter = dependentsRouter;
        serverDeps.addDependent = addDependent;
        serverDeps.enrollmentRequestsRouter = enrollmentRequestsRouter;
        serverDeps.createEnrollmentRequest = createEnrollmentRequest;
        serverDeps.approveEnrollmentRequest = approveEnrollmentRequest;
    }

    return makeServer(serverDeps);
}
