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
import { makeAuthMiddleware } from './infra/http/middlewares/auth';
import { SchoolRepositoryAdapter } from './infra/db/typeorm/school-repository.adap';
import { CourseRepositoryAdapter } from './infra/db/typeorm/course-repository.adap';
import { CourseClassRepositoryAdapter } from './infra/db/typeorm/course-class-repository.adap';
import { DependentRepositoryAdapter } from './infra/db/typeorm/dependent-repository.adap';
import { EnrollmentRepositoryAdapter } from './infra/db/typeorm/enrollment-repository.adap';
import { EnrollmentRequestRepositoryAdapter } from './infra/db/typeorm/enrollment-request-repository.adap';
import { CreateSchool } from './app/use-cases/create-school';
import { CreateCourse } from './app/use-cases/create-course';
import { CreateCourseClass } from './app/use-cases/create-course-class';
import { AddDependent } from './app/use-cases/add-dependent';
import { CreateEnrollmentRequest } from './app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from './app/use-cases/approve-enrollment-request';
import { schoolsRouter } from './infra/http/routes/schools.routes';
import { dependentsRouter } from './infra/http/routes/dependents.routes';
import { enrollmentRequestsRouter } from './infra/http/routes/enrollment-requests.routes';


(async () => {
    await AppDataSource.initialize();
    const payments = new PaymentRepositoryAdapter();
    const users = new UserRepositoryAdapter();
    const schools = new SchoolRepositoryAdapter();
    const courses = new CourseRepositoryAdapter();
    const courseClasses = new CourseClassRepositoryAdapter();
    const dependents = new DependentRepositoryAdapter();
    const enrollments = new EnrollmentRepositoryAdapter();
    const enrollmentRequests = new EnrollmentRequestRepositoryAdapter();
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
    const authMiddleware = makeAuthMiddleware(tokenProvider);
    const createSchool = new CreateSchool(schools);
    const createCourse = new CreateCourse(schools, courses);
    const createCourseClass = new CreateCourseClass(courses, courseClasses);
    const addDependent = new AddDependent(users, dependents);
    const createEnrollmentRequest = new CreateEnrollmentRequest(schools, courses, courseClasses, users, dependents, enrollments, enrollmentRequests);
    const approveEnrollmentRequest = new ApproveEnrollmentRequest(enrollmentRequests, enrollments);

    const app = makeServer({
        paymentsRouter,
        healthRouter,
        authRouter,
        schoolsRouter,
        dependentsRouter,
        enrollmentRequestsRouter,
        createPayment,
        capturePayment,
        registerUser,
        loginUser,
        createSchool,
        createCourse,
        createCourseClass,
        addDependent,
        createEnrollmentRequest,
        approveEnrollmentRequest,
        authMiddleware
    });

    app.listen(process.env.PORT ?? 3000, () => console.log(`API on http://localhost:${process.env.PORT ?? 3000}`));
})();
