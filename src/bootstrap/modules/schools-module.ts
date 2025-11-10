import { ModuleBuildResult, ModuleSetupContext } from './types';
import { SchoolRepositoryAdapter } from '../../infra/db/typeorm/school-repository.adapter';
import { CourseRepositoryAdapter } from '../../infra/db/typeorm/course-repository.adapter';
import { CourseClassRepositoryAdapter } from '../../infra/db/typeorm/course-class-repository.adapter';
import { UserRepositoryAdapter } from '../../infra/db/typeorm/user-repository.adapter';
import { DependentRepositoryAdapter } from '../../infra/db/typeorm/dependent-repository.adapter';
import { CreateSchool } from '../../app/use-cases/create-school';
import { CreateCourse } from '../../app/use-cases/create-course';
import { CreateCourseClass } from '../../app/use-cases/create-course-class';
import { UpdateCourseClass } from '../../app/use-cases/update-course-class';
import { schoolsRouter } from '../../infra/http/routes/schools.routes';
import { ListStudents } from '../../app/use-cases/list-students';
import { studentsRouter } from '../../infra/http/routes/students.routes';
import { ClassSessionRepositoryAdapter } from '../../infra/db/typeorm/class-session-repository.adapter';
import { ScheduleClassSession } from '../../app/use-cases/schedule-class-session';
import { ListClassSessions } from '../../app/use-cases/list-class-sessions';
import { CancelClassSession } from '../../app/use-cases/cancel-class-session';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { TokenProviderPort } from '../../ports/providers/token-provider.port';
import { LoginSchool } from '../../app/use-cases/login-school';
import { SchoolPlanFinanceRepositoryAdapter } from '../../infra/db/typeorm/school-plan-finance-repository.adapter';
import { GetActiveSchoolPlan } from '../../app/use-cases/get-active-school-plan';
import { SubscriptionPlanRepositoryAdapter } from '../../infra/db/typeorm/subscription-plan-repository.adapter';
import { ListSubscriptionPlans } from '../../app/use-cases/list-subscription-plans';
import { AssignSchoolPlan } from '../../app/use-cases/assign-school-plan';
import { CategoryRepositoryAdapter } from '../../infra/db/typeorm/category-repository.adapter';
import { ListCategories } from '../../app/use-cases/list-categories';
import { ListSchoolCourses } from '../../app/use-cases/list-school-courses';
import { GetSchoolCourse } from '../../app/use-cases/get-school-course';
import { ListCourseClasses } from '../../app/use-cases/list-course-classes';
import { GetCourseClass } from '../../app/use-cases/get-course-class';
import { GetSchoolProfile } from '../../app/use-cases/get-school-profile';
import { UpdateSchool } from '../../app/use-cases/update-school';
import { UpdateCourse } from '../../app/use-cases/update-course';
import { DeleteCourse } from '../../app/use-cases/delete-course';
import { SchoolPlanInvoiceRepositoryAdapter } from '../../infra/db/typeorm/school-plan-invoice-repository.adapter';
import { IssueSchoolPlanInvoice } from '../../app/use-cases/issue-school-plan-invoice';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { HandleAsaasPaymentWebhook } from '../../app/use-cases/handle-asaas-payment-webhook';
import { asaasWebhookRouter } from '../../infra/http/routes/webhooks/asaas.routes';
import { ListSchoolPlanInvoices } from '../../app/use-cases/list-school-plan-invoices';
import { EnrollmentRepositoryAdapter } from '../../infra/db/typeorm/enrollment-repository.adapter';
import { EnrollmentRequestRepositoryAdapter } from '../../infra/db/typeorm/enrollment-request-repository.adapter';
import { SchoolFinancialChargeRepositoryAdapter } from '../../infra/db/typeorm/school-financial-charge-repository.adapter';
import { EnrollStudent } from '../../app/use-cases/enroll-student';
import { DeleteCourseClass } from '../../app/use-cases/delete-course-class';
import { ListSchoolStudents } from '../../app/use-cases/list-school-students';
import { ListSchoolPayments } from '../../app/use-cases/list-school-payments';
import { enrollmentRequestsRouter } from '../../infra/http/routes/enrollment-requests.routes';
import { ListEnrollmentRequests } from '../../app/use-cases/list-enrollment-requests';
import { CreateEnrollmentRequest } from '../../app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from '../../app/use-cases/approve-enrollment-request';
import { IssueEnrollmentFeeBoleto } from '../../app/use-cases/issue-enrollment-fee-boleto';
import { GetEnrollmentRequest } from '../../app/use-cases/get-enrollment-request';
import { CreateSchoolCharge } from '../../app/use-cases/create-school-charge';
import { landingRouter } from '../../infra/http/routes/landing.routes';

export type SchoolsModuleDeps = {
    schoolsRepo: SchoolRepositoryAdapter;
    coursesRepo: CourseRepositoryAdapter;
    classesRepo: CourseClassRepositoryAdapter;
    usersRepo: UserRepositoryAdapter;
    dependentsRepo: DependentRepositoryAdapter;
    enrollmentsRepo: EnrollmentRepositoryAdapter;
    enrollmentRequestsRepo: EnrollmentRequestRepositoryAdapter;
    financialChargesRepo: SchoolFinancialChargeRepositoryAdapter;
    subscriptionPlansRepo: SubscriptionPlanRepositoryAdapter;
    categoriesRepo: CategoryRepositoryAdapter;
    planFinancesRepo: SchoolPlanFinanceRepositoryAdapter;
    planInvoicesRepo: SchoolPlanInvoiceRepositoryAdapter;
    classSessionsRepo: ClassSessionRepositoryAdapter;
    passwordHasher: PasswordHasherPort;
    tokenProvider: TokenProviderPort;
    tokenTtl: number;
    paymentProvider: PaymentProviderPort & Partial<AsaasProviderPort>;
};

export function buildSchoolsModule(deps: SchoolsModuleDeps, ctx: ModuleSetupContext): ModuleBuildResult {
    const createSchool = new CreateSchool(deps.schoolsRepo, deps.passwordHasher);
    const createCourse = new CreateCourse(deps.schoolsRepo, deps.coursesRepo);
    const createCourseClass = new CreateCourseClass(deps.coursesRepo, deps.classesRepo);
    const updateCourseClass = new UpdateCourseClass(deps.coursesRepo, deps.classesRepo);
    const deleteCourse = new DeleteCourse(deps.coursesRepo, deps.classesRepo);
    const deleteCourseClass = new DeleteCourseClass(deps.coursesRepo, deps.classesRepo, deps.enrollmentsRepo, deps.enrollmentRequestsRepo);
    const listSchoolCourses = new ListSchoolCourses(deps.coursesRepo, deps.categoriesRepo);
    const getSchoolCourse = new GetSchoolCourse(deps.coursesRepo);
    const updateCourse = new UpdateCourse(deps.schoolsRepo, deps.coursesRepo);
    const listCourseClasses = new ListCourseClasses(deps.coursesRepo, deps.classesRepo);
    const getCourseClass = new GetCourseClass(deps.coursesRepo, deps.classesRepo);
    const getSchoolProfile = new GetSchoolProfile(deps.schoolsRepo);
    const updateSchool = new UpdateSchool(deps.schoolsRepo, deps.passwordHasher);
    const listStudents = new ListStudents(
        deps.usersRepo,
        deps.dependentsRepo,
        deps.coursesRepo,
        deps.classesRepo,
        deps.enrollmentsRepo
    );
    const listSchoolStudents = new ListSchoolStudents(
        deps.coursesRepo,
        deps.classesRepo,
        deps.enrollmentsRepo,
        deps.usersRepo,
        deps.dependentsRepo
    );
    const listSchoolPayments = new ListSchoolPayments(
        deps.coursesRepo,
        deps.classesRepo,
        deps.usersRepo,
        deps.dependentsRepo
    );
    const enrollStudent = new EnrollStudent(deps.coursesRepo, deps.classesRepo, deps.usersRepo, deps.dependentsRepo, deps.enrollmentsRepo);
    const listEnrollmentRequests = new ListEnrollmentRequests(deps.enrollmentRequestsRepo);
    const createEnrollmentRequest = new CreateEnrollmentRequest(
        deps.schoolsRepo,
        deps.coursesRepo,
        deps.classesRepo,
        deps.usersRepo,
        deps.dependentsRepo,
        deps.enrollmentsRepo,
        deps.enrollmentRequestsRepo
    );
    const approveEnrollmentRequest = new ApproveEnrollmentRequest(
        deps.enrollmentRequestsRepo,
        deps.enrollmentsRepo,
        deps.classesRepo,
        deps.financialChargesRepo
    );
    const issueEnrollmentFeeBoleto = new IssueEnrollmentFeeBoleto(
        deps.financialChargesRepo,
        deps.usersRepo,
        deps.paymentProvider
    );
    const getEnrollmentRequest = new GetEnrollmentRequest(deps.enrollmentRequestsRepo);
    const createSchoolCharge = new CreateSchoolCharge(
        deps.financialChargesRepo,
        deps.coursesRepo,
        deps.classesRepo,
        deps.usersRepo,
        deps.dependentsRepo
    );
    const scheduleClassSession = new ScheduleClassSession(deps.classSessionsRepo, deps.classesRepo, deps.coursesRepo);
    const listClassSessions = new ListClassSessions(deps.classSessionsRepo, deps.classesRepo, deps.coursesRepo);
    const cancelClassSession = new CancelClassSession(deps.classSessionsRepo);
    const loginSchool = new LoginSchool(deps.schoolsRepo, deps.passwordHasher, deps.tokenProvider, deps.tokenTtl);
    const getActiveSchoolPlan = new GetActiveSchoolPlan(deps.planFinancesRepo);
    const listSubscriptionPlans = new ListSubscriptionPlans(deps.subscriptionPlansRepo);
    const issueSchoolPlanInvoice = new IssueSchoolPlanInvoice(
        deps.schoolsRepo,
        deps.planFinancesRepo,
        deps.planInvoicesRepo,
        deps.paymentProvider
    );
    const listSchoolPlanInvoices = new ListSchoolPlanInvoices(
        deps.planFinancesRepo,
        deps.planInvoicesRepo
    );
    const asaasProvider = typeof deps.paymentProvider.createSubAccount === 'function'
        ? deps.paymentProvider as AsaasProviderPort
        : undefined;

    const handleAsaasPaymentWebhook = new HandleAsaasPaymentWebhook(
        deps.planInvoicesRepo,
        deps.planFinancesRepo,
        deps.schoolsRepo,
        asaasProvider
    );
    const assignSchoolPlan = new AssignSchoolPlan(
        deps.schoolsRepo,
        deps.subscriptionPlansRepo,
        deps.planFinancesRepo,
        issueSchoolPlanInvoice
    );
    const listCategories = new ListCategories(deps.categoriesRepo);

    // Montar routers prontos
    const schoolsRouterInstance = schoolsRouter({
        createSchool,
        createCourse,
        createCourseClass,
        updateCourseClass,
        listSchoolCourses,
        getSchoolCourse,
        updateCourse,
        deleteCourse,
        listCourseClasses,
        getCourseClass,
        deleteCourseClass,
        getSchoolProfile,
        updateSchool,
        listSchoolStudents,
        listSchoolPayments,
        enrollStudent,
        listEnrollmentRequests,
        createSchoolCharge,
        scheduleClassSession,
        listClassSessions,
        cancelClassSession,
        loginSchool,
        getActiveSchoolPlan,
        listSubscriptionPlans,
        assignSchoolPlan,
        listCategories,
        issueSchoolPlanInvoice,
        listSchoolPlanInvoices,
        authMiddleware: ctx.authMiddleware,
        schoolsRepo: deps.schoolsRepo
    });

    const asaasWebhookRouterInstance = asaasWebhookRouter({
        handleAsaasPaymentWebhook
    });

    const landingRouterInstance = landingRouter({
        listSubscriptionPlans
    });

    return {
        deps: {
            schoolsRouter: schoolsRouterInstance,
            asaasWebhookRouter: asaasWebhookRouterInstance,
            landingRouter: landingRouterInstance
        },
        docFiles: ['schools.yaml', 'students.yaml', 'enrollment-requests.yaml', 'landing.yaml']
    };
}
