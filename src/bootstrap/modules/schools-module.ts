import { ModuleBuildResult, ModuleSetupContext } from './types';
import { SchoolRepositoryAdapter } from '../../infra/db/typeorm/school-repository';
import { CourseRepositoryAdapter } from '../../infra/db/typeorm/course-repository';
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
import { ListSchools } from '../../app/use-cases/list-schools';
import { ListSchoolCourses } from '../../app/use-cases/list-school-courses';
import { GetSchoolCourse } from '../../app/use-cases/get-school-course';
import { ListCourseClasses } from '../../app/use-cases/list-course-classes';
import { GetCourseClass } from '../../app/use-cases/get-course-class';
import { GetSchoolProfile } from '../../app/use-cases/get-school-profile';
import { UpdateSchool } from '../../app/use-cases/update-school';
import { GetSchoolPendingDocuments } from '../../app/use-cases/get-school-pending-documents';
import { UpdateCourse } from '../../app/use-cases/update-course';
import { DeleteCourse } from '../../app/use-cases/delete-course';
import { SchoolPlanInvoiceRepositoryAdapter } from '../../infra/db/typeorm/school-plan-invoice-repository.adapter';
import { IssueSchoolPlanInvoice } from '../../app/use-cases/issue-school-plan-invoice';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { HandleAsaasPaymentWebhook } from '../../app/use-cases/handle-asaas-payment-webhook';
import { HandleAsaasAccountWebhook } from '../../app/use-cases/handle-asaas-account-webhook';
import { asaasWebhookRouter } from '../../infra/http/routes/webhooks/asaas.routes';
import { ListSchoolPlanInvoices } from '../../app/use-cases/list-school-plan-invoices';
import { EnrollmentRepositoryAdapter } from '../../infra/db/typeorm/enrollment-repository';
import { EnrollmentRequestRepositoryAdapter } from '../../infra/db/typeorm/enrollment-request-repository.adapter';
import { SchoolFinancialChargeRepositoryAdapter } from '../../infra/db/typeorm/school-financial-charge-repository.adapter';
import { EnrollStudent } from '../../app/use-cases/enroll-student';
import { DeleteCourseClass } from '../../app/use-cases/delete-course-class';
import { ListSchoolStudents } from '../../app/use-cases/list-school-students';
import { ListSchoolPayments } from '../../app/use-cases/list-school-payments';
import { ListPaidSchoolPayments } from '../../app/use-cases/list-paid-school-payments';
import { ConsolidateSchoolPayments } from '../../app/use-cases/consolidate-school-payments';
import { enrollmentRequestsRouter } from '../../infra/http/routes/enrollment-requests.routes';
import { ListEnrollmentRequests } from '../../app/use-cases/list-enrollment-requests';
import { CreateEnrollmentRequest } from '../../app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from '../../app/use-cases/approve-enrollment-request';
import { IssueEnrollmentFeeBoleto } from '../../app/use-cases/issue-enrollment-fee-boleto';
import { GenerateTuitionPix } from '../../app/use-cases/generate-tuition-pix';
import { GetEnrollmentRequest } from '../../app/use-cases/get-enrollment-request';
import { CreateSchoolCharge } from '../../app/use-cases/create-school-charge';
import { GetSchoolFinancialSummary } from '../../app/use-cases/get-school-financial-summary';
import { GetSchoolDashboard } from '../../app/use-cases/get-school-dashboard';
import { ListSchoolWithdrawals } from '../../app/use-cases/list-school-withdrawals';
import { RequestSchoolWithdrawal } from '../../app/use-cases/request-school-withdrawal';
import { SchoolWithdrawalRepositoryAdapter } from '../../infra/db/typeorm/school-withdrawal-repository.adapter';
import { landingRouter } from '../../infra/http/routes/landing.routes';
import { SchoolBankAccountRepositoryAdapter } from '../../infra/db/typeorm/school-bank-account-repository.adapter';
import { ListSchoolBankAccounts } from '../../app/use-cases/list-school-bank-accounts';
import { CreateSchoolBankAccount } from '../../app/use-cases/create-school-bank-account';
import { UpdateSchoolBankAccount } from '../../app/use-cases/update-school-bank-account';
import { DeleteSchoolBankAccount } from '../../app/use-cases/delete-school-bank-account';
import { RequestPasswordReset } from '../../app/use-cases/request-password-reset';
import { ResetPassword } from '../../app/use-cases/reset-password';
import { ValidatePasswordResetToken } from '../../app/use-cases/validate-password-reset-token';
import { UpdateSchoolPassword } from '../../app/use-cases/update-school-password';
import { PasswordResetTokenRepositoryAdapter } from '../../infra/db/typeorm/password-reset-token-repository.adapter';
import { EmailProviderPort } from '../../ports/providers/email-provider.port';
import { GetStudentDirectoryEntry } from '../../app/use-cases/get-student-directory-entry';
import { GetSchoolStudentDetails } from '../../app/use-cases/get-school-student-details';
import { StorageProviderPort } from '../../ports/providers/storage-provider.port';
import { UploadSchoolImage } from '../../app/use-cases/upload-school-image';
import { ListSchoolImages } from '../../app/use-cases/list-school-images';
import { SchoolImageRepositoryAdapter } from '../../infra/db/typeorm/school-image-repository.adapter';
import { DiscountCouponRepositoryAdapter } from '../../infra/db/typeorm/discount-coupon-repository.adapter';
import { ValidateSchoolCoupon } from '../../app/use-cases/validate-school-coupon';
import { NotificationRepositoryAdapter } from '../../infra/db/typeorm/notification-repository.adapter';
import { ListSchoolNotifications } from '../../app/use-cases/list-school-notifications';
import { buildNotificationsRoutes } from '../../infra/http/routes/schools/notifications.routes';
import { GetSchoolBalance } from '../../app/use-cases/get-school-balance';
import { OutboxRepository } from '../../ports/repositories/outbox.repo';
import { SendClassPushNotification } from '../../app/use-cases/send-class-push-notification';

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
    bankAccountsRepo?: SchoolBankAccountRepositoryAdapter;
    emailProvider?: EmailProviderPort;
    frontendBaseUrl?: string;
    storageProvider?: StorageProviderPort;
    notificationsRepo?: NotificationRepositoryAdapter;
    outbox?: OutboxRepository;
};

export function buildSchoolsModule(deps: SchoolsModuleDeps, ctx: ModuleSetupContext): ModuleBuildResult {
    // Declarar asaasProvider antes de usar
    const asaasProvider = typeof deps.paymentProvider.createSubAccount === 'function'
        ? deps.paymentProvider as AsaasProviderPort
        : undefined;
    
    const createSchool = new CreateSchool(deps.schoolsRepo, deps.passwordHasher, deps.usersRepo);
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
    const schoolImagesRepo = new SchoolImageRepositoryAdapter();
    const getSchoolProfile = new GetSchoolProfile(
        deps.schoolsRepo,
        deps.bankAccountsRepo,
        schoolImagesRepo,
        deps.storageProvider,
        deps.planFinancesRepo,
        deps.planInvoicesRepo
    );
    const updateSchool = new UpdateSchool(deps.schoolsRepo, deps.passwordHasher);
    const getSchoolPendingDocuments = asaasProvider
        ? new GetSchoolPendingDocuments(deps.schoolsRepo, asaasProvider)
        : undefined;
    
    const listSchoolBankAccounts = deps.bankAccountsRepo
        ? new ListSchoolBankAccounts(deps.bankAccountsRepo)
        : undefined;
    const createSchoolBankAccount = deps.bankAccountsRepo
        ? new CreateSchoolBankAccount(deps.schoolsRepo, deps.bankAccountsRepo)
        : undefined;
    const updateSchoolBankAccount = deps.bankAccountsRepo
        ? new UpdateSchoolBankAccount(deps.bankAccountsRepo)
        : undefined;
    const deleteSchoolBankAccount = deps.bankAccountsRepo
        ? new DeleteSchoolBankAccount(deps.bankAccountsRepo)
        : undefined;
    
    const resetTokensRepo = new PasswordResetTokenRepositoryAdapter();
    const requestPasswordReset = new RequestPasswordReset(
        deps.schoolsRepo, 
        resetTokensRepo, 
        deps.emailProvider,
        deps.frontendBaseUrl
    );
    const resetPassword = new ResetPassword(deps.schoolsRepo, resetTokensRepo, deps.passwordHasher);
    const validatePasswordResetToken = new ValidatePasswordResetToken(resetTokensRepo);
    const updateSchoolPassword = new UpdateSchoolPassword(deps.schoolsRepo, deps.passwordHasher);
    
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
    const getStudentDirectoryEntry = new GetStudentDirectoryEntry(deps.usersRepo, deps.dependentsRepo);
    const getSchoolStudentDetails = new GetSchoolStudentDetails(
        deps.usersRepo,
        deps.dependentsRepo,
        deps.enrollmentsRepo,
        deps.coursesRepo,
        deps.classesRepo,
        deps.financialChargesRepo
    );
    const listSchoolPayments = new ListSchoolPayments(
        deps.coursesRepo,
        deps.classesRepo,
        deps.usersRepo,
        deps.dependentsRepo
    );
    const listPaidSchoolPayments = new ListPaidSchoolPayments(
        deps.coursesRepo,
        deps.classesRepo,
        deps.usersRepo,
        deps.dependentsRepo
    );
    const consolidateSchoolPayments = new ConsolidateSchoolPayments(
        deps.coursesRepo,
        deps.classesRepo
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
    const issueEnrollmentFeeBoleto = new IssueEnrollmentFeeBoleto(
        deps.financialChargesRepo,
        deps.usersRepo,
        deps.schoolsRepo,
        deps.paymentProvider
    );
    const generateTuitionPix = new GenerateTuitionPix(
        deps.financialChargesRepo,
        deps.usersRepo,
        deps.schoolsRepo,
        deps.coursesRepo,
        deps.paymentProvider
    );
    const approveEnrollmentRequest = new ApproveEnrollmentRequest(
        deps.enrollmentRequestsRepo,
        deps.enrollmentsRepo,
        deps.classesRepo,
        deps.coursesRepo,
        deps.financialChargesRepo,
        issueEnrollmentFeeBoleto,
        generateTuitionPix
    );
    const getEnrollmentRequest = new GetEnrollmentRequest(deps.enrollmentRequestsRepo);
    const createSchoolCharge = new CreateSchoolCharge(
        deps.financialChargesRepo,
        deps.coursesRepo,
        deps.classesRepo,
        deps.usersRepo,
        deps.dependentsRepo
    );
    const getSchoolFinancialSummary = new GetSchoolFinancialSummary(deps.financialChargesRepo);
    const getSchoolBalance = asaasProvider
        ? new GetSchoolBalance(deps.schoolsRepo, asaasProvider)
        : undefined;
    const getSchoolDashboard = new GetSchoolDashboard(
        deps.coursesRepo,
        deps.classesRepo,
        deps.enrollmentsRepo,
        deps.financialChargesRepo,
        deps.enrollmentRequestsRepo
    );
    const withdrawalsRepo = new SchoolWithdrawalRepositoryAdapter();
    const listSchoolWithdrawals = new ListSchoolWithdrawals(withdrawalsRepo);
    
    const requestSchoolWithdrawal = deps.bankAccountsRepo && asaasProvider
        ? new RequestSchoolWithdrawal(
            deps.schoolsRepo,
            deps.bankAccountsRepo,
            withdrawalsRepo,
            deps.financialChargesRepo,
            asaasProvider
        )
        : undefined;
    const scheduleClassSession = new ScheduleClassSession(deps.classSessionsRepo, deps.classesRepo, deps.coursesRepo);
    const listClassSessions = new ListClassSessions(deps.classSessionsRepo, deps.classesRepo, deps.coursesRepo);
    const cancelClassSession = new CancelClassSession(deps.classSessionsRepo);
    const loginSchool = new LoginSchool(
        deps.schoolsRepo,
        deps.passwordHasher,
        deps.tokenProvider,
        deps.tokenTtl,
        deps.planFinancesRepo,
        deps.planInvoicesRepo
    );
    const getActiveSchoolPlan = new GetActiveSchoolPlan(deps.planFinancesRepo);
    const listSubscriptionPlans = new ListSubscriptionPlans(deps.subscriptionPlansRepo);
    const couponsRepo = new DiscountCouponRepositoryAdapter();
    const issueSchoolPlanInvoice = new IssueSchoolPlanInvoice(
        deps.schoolsRepo,
        deps.planFinancesRepo,
        deps.planInvoicesRepo,
        deps.paymentProvider,
        couponsRepo
    );
    const listSchoolPlanInvoices = new ListSchoolPlanInvoices(
        deps.planFinancesRepo,
        deps.planInvoicesRepo
    );

    const handleAsaasPaymentWebhook = new HandleAsaasPaymentWebhook(
        deps.planInvoicesRepo,
        deps.planFinancesRepo,
        deps.schoolsRepo,
        asaasProvider
    );
    const handleAsaasAccountWebhook = new HandleAsaasAccountWebhook(
        deps.schoolsRepo
    );
    const assignSchoolPlan = new AssignSchoolPlan(
        deps.schoolsRepo,
        deps.subscriptionPlansRepo,
        deps.planFinancesRepo,
        issueSchoolPlanInvoice
    );
    const validateSchoolCoupon = new ValidateSchoolCoupon(
        couponsRepo,
        deps.subscriptionPlansRepo
    );
    const listCategories = new ListCategories(deps.categoriesRepo);
    const listSchools = new ListSchools(deps.schoolsRepo);
    const uploadSchoolImage = deps.storageProvider
        ? new UploadSchoolImage(deps.schoolsRepo, schoolImagesRepo, deps.storageProvider)
        : undefined;
    const listSchoolImages = deps.storageProvider
        ? new ListSchoolImages(schoolImagesRepo, deps.storageProvider)
        : undefined;
    const listSchoolNotifications = deps.notificationsRepo
        ? new ListSchoolNotifications(deps.notificationsRepo)
        : undefined;
    const sendClassPushNotification = deps.notificationsRepo && deps.outbox
        ? new SendClassPushNotification(deps.coursesRepo, deps.classesRepo, deps.enrollmentsRepo, deps.notificationsRepo, deps.outbox)
        : undefined;

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
        listPaidSchoolPayments,
        consolidateSchoolPayments,
        enrollStudent,
        listEnrollmentRequests,
        createSchoolCharge,
        getSchoolFinancialSummary,
        getSchoolBalance,
        getSchoolDashboard,
        listSchoolWithdrawals,
        requestSchoolWithdrawal,
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
        schoolsRepo: deps.schoolsRepo,
        listSchoolBankAccounts,
        createSchoolBankAccount,
        updateSchoolBankAccount,
        deleteSchoolBankAccount,
        requestPasswordReset,
        resetPassword,
        validatePasswordResetToken,
        updateSchoolPassword,
        getStudentDirectoryEntry,
        getSchoolStudentDetails,
        uploadSchoolImage,
        listSchoolImages,
        validateSchoolCoupon,
        listSchoolNotifications,
        sendClassPushNotification,
        getSchoolPendingDocuments
    });

    const asaasWebhookRouterInstance = asaasWebhookRouter({
        handleAsaasPaymentWebhook,
        handleAsaasAccountWebhook
    });

    const landingRouterInstance = landingRouter({
        listSubscriptionPlans
    });

    const enrollmentRequestsRouterInstance = enrollmentRequestsRouter({
        createEnrollmentRequest,
        approveEnrollmentRequest,
        listEnrollmentRequests,
        getEnrollmentRequest,
        issueEnrollmentFeeBoleto
    });

    return {
        deps: {
            schoolsRouter: schoolsRouterInstance,
            asaasWebhookRouter: asaasWebhookRouterInstance,
            landingRouter: landingRouterInstance,
            enrollmentRequestsRouter: enrollmentRequestsRouterInstance
        },
        docFiles: ['schools.yaml', 'students.yaml', 'enrollment-requests.yaml', 'landing.yaml']
    };
}
