import { ModuleBuildResult, ModuleSetupContext } from './types';
import { adminRouter } from '../../infra/http/routes/admin.routes';
import { GetAdminStatus } from '../../app/use-cases/admin/get-admin-status';
import { ListSchoolsWithPlans } from '../../app/use-cases/admin/list-schools-with-plans';
import { LoginAdmin } from '../../app/use-cases/auth/login-admin';
import { GetAdminDashboard } from '../../app/use-cases/admin/get-admin-dashboard';
import { CreateDiscountCoupon } from '../../app/use-cases/admin/create-discount-coupon';
import { ListDiscountCoupons } from '../../app/use-cases/admin/list-discount-coupons';
import { ValidateDiscountCoupon } from '../../app/use-cases/admin/validate-discount-coupon';
import { DiscountCouponRepositoryAdapter } from '../../infra/db/typeorm/discount-coupon-repository.adapter';
import { MODULE_DOC_FILES, type ModuleName } from '../module-config';
import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import type { SubscriptionPlanRepository } from '../../ports/repositories/subscription-plan.repo';
import type { CategoryRepository } from '../../ports/repositories/category.repo';
import type { UserRepository } from '../../ports/repositories/user.repo';
import type { CourseRepository } from '../../ports/repositories/course.repo';
import type { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import type { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import type { DependentRepository } from '../../ports/repositories/dependent.repo';
import type { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import type { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import type { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import type { ChargeDueReminderRepository } from '../../ports/repositories/charge-due-reminder.repo';
import type { NotificationRepository } from '../../ports/repositories/notification.repo';
import type { OutboxRepository } from '../../ports/repositories/outbox.repo';
import type { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import type { TokenProviderPort } from '../../ports/providers/token-provider.port';
import type { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { ResendSchoolAsaasAccount } from '../../app/use-cases/schools/resend-school-asaas-account';
import { GetAdminSchoolDetails } from '../../app/use-cases/admin/get-admin-school-details';
import { GetAdminSchoolPlans } from '../../app/use-cases/admin/get-admin-school-plans';
import { UpdateSchool } from '../../app/use-cases/schools/update-school';
import { AdminUpdateSchoolRegistration } from '../../app/use-cases/admin/admin-update-school-registration';
import { ListAdminSubscriptionPlans } from '../../app/use-cases/admin/list-admin-subscription-plans';
import { CreateSubscriptionPlan } from '../../app/use-cases/admin/create-subscription-plan';
import { UpdateSubscriptionPlan } from '../../app/use-cases/admin/update-subscription-plan';
import { ListAdminCategories } from '../../app/use-cases/admin/list-admin-categories';
import { CreateCategory } from '../../app/use-cases/admin/create-category';
import { UpdateCategory } from '../../app/use-cases/admin/update-category';
import { ListSchoolStudents } from '../../app/use-cases/schools/list-school-students';
import { ListAllStudents } from '../../app/use-cases/admin/list-all-students';
import { GetAdminSchoolFinancial } from '../../app/use-cases/admin/get-admin-school-financial';
import { GetSchoolBalance } from '../../app/use-cases/schools/get-school-balance';
import { GetAdminSchoolBilling } from '../../app/use-cases/admin/get-admin-school-billing';
import { ListAdminSchoolInvoices } from '../../app/use-cases/admin/list-admin-school-invoices';
import { ListAdminPaymentHistory } from '../../app/use-cases/admin/list-admin-payment-history';
import { ListAdminEnrollmentRequests } from '../../app/use-cases/admin/list-admin-enrollment-requests';
import { ListAdminStudentCharges } from '../../app/use-cases/admin/list-admin-student-charges';
import { ListAdminStudentCourses } from '../../app/use-cases/admin/list-admin-student-courses';
import { GetAdminStudentDetails } from '../../app/use-cases/admin/get-admin-student-details';
import { UpdateAdminStudent } from '../../app/use-cases/admin/update-admin-student';
import { AdminSoftDeleteUser } from '../../app/use-cases/admin/admin-soft-delete-user';
import { AdminSoftDeleteSchool } from '../../app/use-cases/admin/admin-soft-delete-school';
import { ListAdminSchoolCourses } from '../../app/use-cases/admin/list-admin-school-courses';
import { SchoolWithdrawalRepositoryAdapter } from '../../infra/db/typeorm/school-withdrawal-repository.adapter';
import { ScheduleChargeDueReminders } from '../../app/use-cases/payments/schedule-charge-due-reminders';
import { NotifyStudentUser } from '../../app/use-cases/shared/notify-student-user';
import { AdminMarkInvoicePaid } from '../../app/use-cases/admin/admin-mark-invoice-paid';
import { AdminMarkChargePaid } from '../../app/use-cases/admin/admin-mark-charge-paid';
import { AdminDeleteCharge } from '../../app/use-cases/admin/admin-delete-charge';
import { UnenrollStudentFromClass } from '../../app/use-cases/enrollments/unenroll-student-from-class';
import { SyncSchoolOnboardingDocuments } from '../../app/use-cases/schools/sync-school-onboarding-documents';
import { AdminUploadSchoolOnboardingDocument } from '../../app/use-cases/admin/admin-upload-school-onboarding-document';
import { GetSchoolPendingDocuments } from '../../app/use-cases/schools/get-school-pending-documents';
import { SyncSchoolSubaccountStatus } from '../../app/use-cases/schools/sync-school-subaccount-status';
import { scheduleAllJobs } from '../../infra/messaging/bullmq/job-scheduler';
import { startWorker } from '../../infra/messaging/bullmq/worker-manager';
import { log } from '../../shared/logger';
import { JobExecutionLogRepositoryAdapter } from '../../infra/db/typeorm/job-execution-log-repository.adapter';
import { SchoolImageRepositoryAdapter } from '../../infra/db/typeorm/school-image-repository.adapter';
import type { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import type { StorageProviderPort } from '../../ports/providers/storage-provider.port';
import { ListAdminJobLogs } from '../../app/use-cases/admin/list-admin-job-logs';
import { GetAdminJobLog } from '../../app/use-cases/admin/get-admin-job-log';

type AdminModuleDeps = {
    getActiveModules: () => readonly ModuleName[];
    getOpenApiFiles: () => readonly string[];
    getEnvironmentInfo: () => {
        nodeEnv: string | null;
        appModulesEnv: string | null;
    };
    schoolsRepo: SchoolRepository;
    planFinancesRepo: SchoolPlanFinanceRepository;
    subscriptionPlansRepo: SubscriptionPlanRepository;
    categoriesRepo: CategoryRepository;
    usersRepo: UserRepository;
    coursesRepo: CourseRepository;
    classesRepo: CourseClassRepository;
    enrollmentsRepo: EnrollmentRepository;
    dependentsRepo: DependentRepository;
    financialChargesRepo: SchoolFinancialChargeRepository;
    planInvoicesRepo: SchoolPlanInvoiceRepository;
    enrollmentRequestsRepo: EnrollmentRequestRepository;
    outbox: OutboxRepository;
    chargeDueReminderRepo: ChargeDueReminderRepository;
    passwordHasher: PasswordHasherPort;
    tokenProvider: TokenProviderPort;
    tokenTtl: number;
    asaasProvider?: AsaasProviderPort;
    notificationsRepo?: NotificationRepository;
    storageProvider?: StorageProviderPort;
};

export function buildAdminModule(deps: AdminModuleDeps, ctx: ModuleSetupContext): ModuleBuildResult {
    const getAdminStatus = new GetAdminStatus(
        () => deps.getActiveModules(),
        () => deps.getOpenApiFiles(),
        () => deps.getEnvironmentInfo()
    );

    const listSchoolsWithPlans = new ListSchoolsWithPlans(
        deps.schoolsRepo,
        deps.planFinancesRepo,
        deps.planInvoicesRepo,
        deps.coursesRepo,
        deps.classesRepo,
        deps.enrollmentsRepo
    );

    const schoolImagesRepo: SchoolImageRepository = new SchoolImageRepositoryAdapter();
    const getAdminSchoolDetails = new GetAdminSchoolDetails(
        deps.schoolsRepo,
        deps.usersRepo,
        deps.planFinancesRepo,
        deps.planInvoicesRepo,
        deps.asaasProvider,
        schoolImagesRepo,
        deps.storageProvider
    );

    const getAdminSchoolPlans = new GetAdminSchoolPlans(
        deps.planFinancesRepo
    );

    const listAdminSubscriptionPlans = new ListAdminSubscriptionPlans(deps.subscriptionPlansRepo);
    const createSubscriptionPlan = new CreateSubscriptionPlan(deps.subscriptionPlansRepo);
    const updateSubscriptionPlan = new UpdateSubscriptionPlan(deps.subscriptionPlansRepo);

    const listAdminCategories = new ListAdminCategories(deps.categoriesRepo);
    const createCategory = new CreateCategory(deps.categoriesRepo);
    const updateCategory = new UpdateCategory(deps.categoriesRepo);

    const updateSchool = new UpdateSchool(
        deps.schoolsRepo,
        deps.passwordHasher,
        deps.usersRepo
    );
    const adminUpdateSchoolRegistration = new AdminUpdateSchoolRegistration(
        deps.schoolsRepo,
        updateSchool
    );

    const loginAdmin = new LoginAdmin(
        deps.usersRepo,
        deps.passwordHasher,
        deps.tokenProvider,
        deps.tokenTtl
    );

    const getAdminDashboard = new GetAdminDashboard(
        deps.schoolsRepo,
        deps.classesRepo,
        deps.enrollmentsRepo,
        deps.financialChargesRepo,
        deps.planInvoicesRepo,
        listSchoolsWithPlans
    );

    const listSchoolStudents = new ListSchoolStudents(
        deps.coursesRepo,
        deps.classesRepo,
        deps.enrollmentsRepo,
        deps.usersRepo,
        deps.dependentsRepo
    );

    const listAllStudents = new ListAllStudents(deps.enrollmentsRepo, deps.usersRepo, deps.dependentsRepo);

    const listAdminStudentCourses = new ListAdminStudentCourses(deps.usersRepo, deps.dependentsRepo);
    const getAdminStudentDetails = new GetAdminStudentDetails(deps.usersRepo, deps.dependentsRepo);
    const updateAdminStudent = new UpdateAdminStudent(deps.usersRepo, deps.dependentsRepo);
    const listAdminSchoolCourses = new ListAdminSchoolCourses(
        deps.coursesRepo,
        deps.categoriesRepo,
        deps.classesRepo,
        deps.enrollmentsRepo
    );

    const withdrawalsRepo = new SchoolWithdrawalRepositoryAdapter();
    const getSchoolBalanceForAdmin = deps.asaasProvider
        ? new GetSchoolBalance(deps.schoolsRepo, deps.asaasProvider)
        : undefined;
    const getAdminSchoolFinancial = new GetAdminSchoolFinancial(
        deps.schoolsRepo,
        deps.financialChargesRepo,
        withdrawalsRepo,
        getSchoolBalanceForAdmin
    );

    const getAdminSchoolBilling = new GetAdminSchoolBilling(
        deps.schoolsRepo,
        deps.financialChargesRepo
    );

    const listAdminSchoolInvoices = deps.planInvoicesRepo
        ? new ListAdminSchoolInvoices(deps.schoolsRepo, deps.planInvoicesRepo)
        : undefined;

    const listAdminPaymentHistory = deps.planInvoicesRepo
        ? new ListAdminPaymentHistory(deps.planInvoicesRepo, deps.asaasProvider)
        : undefined;

    const listAdminEnrollmentRequests = deps.enrollmentRequestsRepo?.findManyForAdmin
        ? new ListAdminEnrollmentRequests(deps.enrollmentRequestsRepo)
        : undefined;

    const listAdminStudentCharges =
        deps.financialChargesRepo?.findChargesByStudentIdForAdmin
            ? new ListAdminStudentCharges(deps.usersRepo, deps.dependentsRepo, deps.financialChargesRepo)
            : undefined;

    const adminMarkInvoicePaid = deps.planInvoicesRepo
        ? new AdminMarkInvoicePaid(deps.planInvoicesRepo)
        : undefined;
    const adminMarkChargePaid = new AdminMarkChargePaid(
        deps.financialChargesRepo,
        deps.schoolsRepo,
        deps.asaasProvider
    );
    const adminDeleteCharge = new AdminDeleteCharge(
        deps.financialChargesRepo,
        deps.schoolsRepo,
        deps.asaasProvider
    );
    const unenrollStudentFromClass = new UnenrollStudentFromClass(
        deps.coursesRepo,
        deps.classesRepo,
        deps.enrollmentsRepo
    );

    const syncSchoolOnboardingDocuments = deps.asaasProvider
        ? new SyncSchoolOnboardingDocuments(deps.schoolsRepo, deps.asaasProvider)
        : undefined;

    const adminUploadSchoolOnboardingDocument = deps.asaasProvider
        ? new AdminUploadSchoolOnboardingDocument(deps.schoolsRepo, deps.asaasProvider)
        : undefined;

    const notifyStudentForReminders =
        deps.notificationsRepo && deps.outbox
            ? new NotifyStudentUser(deps.notificationsRepo, deps.outbox, deps.schoolsRepo)
            : undefined;

    const scheduleChargeDueReminders = new ScheduleChargeDueReminders(
        deps.financialChargesRepo,
        deps.planInvoicesRepo,
        deps.chargeDueReminderRepo,
        deps.outbox,
        deps.usersRepo,
        deps.schoolsRepo,
        deps.coursesRepo,
        notifyStudentForReminders
    );

    // Use cases de cupons
    const couponsRepo = new DiscountCouponRepositoryAdapter();
    const createDiscountCoupon = new CreateDiscountCoupon(couponsRepo);
    const listDiscountCoupons = new ListDiscountCoupons(couponsRepo);
    const validateDiscountCoupon = new ValidateDiscountCoupon(couponsRepo);

    // Use case para reenviar solicitação de conta Asaas
    const resendSchoolAsaasAccount = deps.asaasProvider
        ? new ResendSchoolAsaasAccount(deps.schoolsRepo, deps.asaasProvider)
        : undefined;

    // Listar documentos pendentes de KYC/onboarding da escola (admin)
    const getSchoolPendingDocuments = deps.asaasProvider
        ? new GetSchoolPendingDocuments(deps.schoolsRepo, deps.asaasProvider)
        : undefined;

    // Sincronizar status da subconta Asaas (GET myAccount/status) e atualizar onboarding
    const syncSchoolSubaccountStatus = deps.asaasProvider
        ? new SyncSchoolSubaccountStatus(deps.schoolsRepo, deps.asaasProvider)
        : undefined;

    const jobExecutionLogsRepo = new JobExecutionLogRepositoryAdapter();
    const listAdminJobLogs = new ListAdminJobLogs(jobExecutionLogsRepo);
    const getAdminJobLog = new GetAdminJobLog(jobExecutionLogsRepo);

    const adminSoftDeleteUser = new AdminSoftDeleteUser(deps.usersRepo, deps.schoolsRepo);
    const adminSoftDeleteSchool = new AdminSoftDeleteSchool(deps.schoolsRepo, adminSoftDeleteUser);

    // Montar router pronto
    const router = adminRouter({
        getAdminStatus,
        listSchoolsWithPlans,
        loginAdmin,
        getAdminDashboard,
        getAdminSchoolDetails,
        getAdminSchoolPlans,
        updateSchool,
        adminUpdateSchoolRegistration,
        listAdminSubscriptionPlans,
        createSubscriptionPlan,
        updateSubscriptionPlan,
        listAdminCategories,
        createCategory,
        updateCategory,
        createDiscountCoupon,
        listDiscountCoupons,
        validateDiscountCoupon,
        schoolsRepo: deps.schoolsRepo,
        resendSchoolAsaasAccount,
        listSchoolStudents,
        listAllStudents,
        listAdminStudentCourses,
        getAdminStudentDetails,
        updateAdminStudent,
        listAdminStudentCharges,
        listAdminSchoolCourses,
        getAdminSchoolFinancial,
        getAdminSchoolBilling,
        listAdminSchoolInvoices,
        listAdminPaymentHistory,
        listAdminEnrollmentRequests,
        adminMarkInvoicePaid,
        adminMarkChargePaid,
        adminDeleteCharge,
        unenrollStudentFromClass,
        syncSchoolOnboardingDocuments,
        adminUploadSchoolOnboardingDocument,
        getSchoolPendingDocuments,
        syncSchoolSubaccountStatus,
        scheduleChargeDueReminders,
        listAdminJobLogs,
        getAdminJobLog,
        adminSoftDeleteUser,
        adminSoftDeleteSchool,
        authMiddleware: ctx.authMiddleware
    });

    // Inicializar jobs e worker quando o módulo ADMIN rodar
    // Isso garante que os jobs sejam agendados e o worker esteja processando
    // Executado de forma assíncrona para não bloquear a inicialização do módulo
    setImmediate(() => {
        initializeJobsAndWorker().catch((error) => {
            log.error('[Admin Module] Erro ao inicializar jobs e worker', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Não bloquear a inicialização do módulo se houver erro
        });
    });

    return {
        deps: {
            adminRouter: router
        },
        docFiles: [...MODULE_DOC_FILES.admin]
    };
}

/**
 * Inicializa os jobs agendados e o worker BullMQ
 * Executado quando o módulo ADMIN é carregado
 */
async function initializeJobsAndWorker(): Promise<void> {
    log.info('[Admin Module] Inicializando jobs e worker...');

    // Verificar se Redis está configurado
    if (!process.env.REDIS_HOST) {
        console.warn('\n[Admin Module] ⚠️  REDIS_HOST não configurado no .env');
        console.warn('[Admin Module] Jobs da fila (emails, push, etc.) NÃO serão processados.');
        console.warn('[Admin Module] Para ativar: defina REDIS_HOST (e opcionalmente REDIS_PORT, REDIS_PASSWORD) no .env e reinicie a API.\n');
        log.warn('[Admin Module] REDIS_HOST não configurado. Jobs e worker não serão iniciados.');
        return;
    }

    try {
        // Agendar todos os jobs repetitivos
        await scheduleAllJobs();
        log.info('[Admin Module] ✓ Jobs agendados com sucesso');

        // Iniciar o worker para processar jobs da fila
        startWorker();
        console.log('[Admin Module] ✓ Worker BullMQ ativo – jobs da fila (emails, push, etc.) serão processados neste processo.');
        log.info('[Admin Module] ✓ Worker iniciado com sucesso');

        // Nota: Os handlers de shutdown (SIGTERM/SIGINT) são configurados no main.ts
        // para garantir shutdown gracioso coordenado de servidor HTTP e worker

        log.info('[Admin Module] ✓ Jobs e worker configurados e rodando');
    } catch (error) {
        log.error('[Admin Module] Erro ao inicializar jobs e worker', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}
