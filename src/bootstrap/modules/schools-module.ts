import { ModuleBuildResult, ModuleSetupContext } from './types';
import { SchoolRepositoryAdapter } from '../../infra/db/typeorm/school-repository.adap';
import { CourseRepositoryAdapter } from '../../infra/db/typeorm/course-repository.adap';
import { CourseClassRepositoryAdapter } from '../../infra/db/typeorm/course-class-repository.adap';
import { UserRepositoryAdapter } from '../../infra/db/typeorm/user-repository.adap';
import { DependentRepositoryAdapter } from '../../infra/db/typeorm/dependent-repository.adap';
import { CreateSchool } from '../../app/use-cases/create-school';
import { CreateCourse } from '../../app/use-cases/create-course';
import { CreateCourseClass } from '../../app/use-cases/create-course-class';
import { schoolsRouter } from '../../infra/http/routes/schools.routes';
import { ListStudents } from '../../app/use-cases/list-students';
import { studentsRouter } from '../../infra/http/routes/students.routes';
import { ClassSessionRepositoryAdapter } from '../../infra/db/typeorm/class-session-repository.adap';
import { ScheduleClassSession } from '../../app/use-cases/schedule-class-session';
import { ListClassSessions } from '../../app/use-cases/list-class-sessions';
import { CancelClassSession } from '../../app/use-cases/cancel-class-session';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { TokenProviderPort } from '../../ports/providers/token-provider.port';
import { LoginSchool } from '../../app/use-cases/login-school';
import { SchoolPlanFinanceRepositoryAdapter } from '../../infra/db/typeorm/school-plan-finance-repository.adap';
import { GetActiveSchoolPlan } from '../../app/use-cases/get-active-school-plan';
import { SubscriptionPlanRepositoryAdapter } from '../../infra/db/typeorm/subscription-plan-repository.adap';
import { ListSubscriptionPlans } from '../../app/use-cases/list-subscription-plans';
import { AssignSchoolPlan } from '../../app/use-cases/assign-school-plan';
import { CategoryRepositoryAdapter } from '../../infra/db/typeorm/category-repository.adap';
import { ListCategories } from '../../app/use-cases/list-categories';
import { ListSchoolCourses } from '../../app/use-cases/list-school-courses';
import { GetSchoolCourse } from '../../app/use-cases/get-school-course';
import { ListCourseClasses } from '../../app/use-cases/list-course-classes';
import { GetCourseClass } from '../../app/use-cases/get-course-class';
import { GetSchoolProfile } from '../../app/use-cases/get-school-profile';
import { UpdateSchool } from '../../app/use-cases/update-school';
import { UpdateCourse } from '../../app/use-cases/update-course';
import { SchoolPlanInvoiceRepositoryAdapter } from '../../infra/db/typeorm/school-plan-invoice-repository.adap';
import { IssueSchoolPlanInvoice } from '../../app/use-cases/issue-school-plan-invoice';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import { HandleAsaasPaymentWebhook } from '../../app/use-cases/handle-asaas-payment-webhook';
import { asaasWebhookRouter } from '../../infra/http/routes/webhooks/asaas.routes';
import { ListSchoolPlanInvoices } from '../../app/use-cases/list-school-plan-invoices';

export type SchoolsModuleDeps = {
    schoolsRepo: SchoolRepositoryAdapter;
    coursesRepo: CourseRepositoryAdapter;
    classesRepo: CourseClassRepositoryAdapter;
    usersRepo: UserRepositoryAdapter;
    dependentsRepo: DependentRepositoryAdapter;
    subscriptionPlansRepo: SubscriptionPlanRepositoryAdapter;
    categoriesRepo: CategoryRepositoryAdapter;
    planFinancesRepo: SchoolPlanFinanceRepositoryAdapter;
    planInvoicesRepo: SchoolPlanInvoiceRepositoryAdapter;
    classSessionsRepo: ClassSessionRepositoryAdapter;
    passwordHasher: PasswordHasherPort;
    tokenProvider: TokenProviderPort;
    tokenTtl: number;
    paymentProvider: PaymentProviderPort;
};

export function buildSchoolsModule(deps: SchoolsModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
    const createSchool = new CreateSchool(deps.schoolsRepo, deps.passwordHasher);
    const createCourse = new CreateCourse(deps.schoolsRepo, deps.coursesRepo);
    const createCourseClass = new CreateCourseClass(deps.coursesRepo, deps.classesRepo);
    const listSchoolCourses = new ListSchoolCourses(deps.coursesRepo);
    const getSchoolCourse = new GetSchoolCourse(deps.coursesRepo);
    const updateCourse = new UpdateCourse(deps.schoolsRepo, deps.coursesRepo);
    const listCourseClasses = new ListCourseClasses(deps.coursesRepo, deps.classesRepo);
    const getCourseClass = new GetCourseClass(deps.coursesRepo, deps.classesRepo);
    const getSchoolProfile = new GetSchoolProfile(deps.schoolsRepo);
    const updateSchool = new UpdateSchool(deps.schoolsRepo, deps.passwordHasher);
    const listStudents = new ListStudents(deps.usersRepo, deps.dependentsRepo);
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
    const handleAsaasPaymentWebhook = new HandleAsaasPaymentWebhook(
        deps.planInvoicesRepo,
        deps.planFinancesRepo
    );
    const assignSchoolPlan = new AssignSchoolPlan(
        deps.schoolsRepo,
        deps.subscriptionPlansRepo,
        deps.planFinancesRepo,
        issueSchoolPlanInvoice
    );
    const listCategories = new ListCategories(deps.categoriesRepo);

    return {
        deps: {
            schoolsRouter,
            createSchool,
            createCourse,
            createCourseClass,
            listSchoolCourses,
            getSchoolCourse,
            updateCourse,
            listCourseClasses,
            getCourseClass,
            getSchoolProfile,
            updateSchool,
            studentsRouter,
            listStudents,
            scheduleClassSession,
            listClassSessions,
            cancelClassSession,
            schoolsRepo: deps.schoolsRepo,
            loginSchool,
            getActiveSchoolPlan,
            listSubscriptionPlans,
            assignSchoolPlan,
            listCategories,
            issueSchoolPlanInvoice,
            handleAsaasPaymentWebhook,
            asaasWebhookRouter,
            listSchoolPlanInvoices
        },
        docFiles: ['schools.yaml', 'students.yaml']
    };
}
