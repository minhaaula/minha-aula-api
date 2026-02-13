import { ModuleBuildResult, ModuleSetupContext } from './types';
import { adminRouter } from '../../infra/http/routes/admin.routes';
import { GetAdminStatus } from '../../app/use-cases/get-admin-status';
import { ListSchoolsWithPlans } from '../../app/use-cases/list-schools-with-plans';
import { LoginAdmin } from '../../app/use-cases/login-admin';
import { GetAdminDashboard } from '../../app/use-cases/get-admin-dashboard';
import { CreateDiscountCoupon } from '../../app/use-cases/create-discount-coupon';
import { ListDiscountCoupons } from '../../app/use-cases/list-discount-coupons';
import { ValidateDiscountCoupon } from '../../app/use-cases/validate-discount-coupon';
import { DiscountCouponRepositoryAdapter } from '../../infra/db/typeorm/discount-coupon-repository.adapter';
import type { ModuleName } from '../module-config';
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
import type { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import type { TokenProviderPort } from '../../ports/providers/token-provider.port';
import type { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { ResendSchoolAsaasAccount } from '../../app/use-cases/resend-school-asaas-account';
import { GetAdminSchoolDetails } from '../../app/use-cases/get-admin-school-details';
import { GetAdminSchoolPlans } from '../../app/use-cases/get-admin-school-plans';
import { UpdateSchool } from '../../app/use-cases/update-school';
import { ListAdminSubscriptionPlans } from '../../app/use-cases/list-admin-subscription-plans';
import { CreateSubscriptionPlan } from '../../app/use-cases/create-subscription-plan';
import { UpdateSubscriptionPlan } from '../../app/use-cases/update-subscription-plan';
import { ListAdminCategories } from '../../app/use-cases/list-admin-categories';
import { CreateCategory } from '../../app/use-cases/create-category';
import { UpdateCategory } from '../../app/use-cases/update-category';
import { ListSchoolStudents } from '../../app/use-cases/list-school-students';
import { ListAllStudents } from '../../app/use-cases/list-all-students';
import { GetAdminSchoolFinancial } from '../../app/use-cases/get-admin-school-financial';
import { GetAdminSchoolBilling } from '../../app/use-cases/get-admin-school-billing';
import { ListAdminSchoolInvoices } from '../../app/use-cases/list-admin-school-invoices';
import { ListAdminPaymentHistory } from '../../app/use-cases/list-admin-payment-history';
import { SchoolWithdrawalRepositoryAdapter } from '../../infra/db/typeorm/school-withdrawal-repository.adapter';
import { scheduleAllJobs } from '../../infra/messaging/bullmq/job-scheduler';
import { startWorker } from '../../infra/messaging/bullmq/worker-manager';
import { log } from '../../shared/logger';

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
    planInvoicesRepo?: SchoolPlanInvoiceRepository;
    passwordHasher: PasswordHasherPort;
    tokenProvider: TokenProviderPort;
    tokenTtl: number;
    asaasProvider?: AsaasProviderPort;
};

export function buildAdminModule(deps: AdminModuleDeps, ctx: ModuleSetupContext): ModuleBuildResult {
    const getAdminStatus = new GetAdminStatus(
        () => deps.getActiveModules(),
        () => deps.getOpenApiFiles(),
        () => deps.getEnvironmentInfo()
    );

    const listSchoolsWithPlans = new ListSchoolsWithPlans(
        deps.schoolsRepo,
        deps.planFinancesRepo
    );

    const getAdminSchoolDetails = new GetAdminSchoolDetails(
        deps.schoolsRepo,
        deps.planFinancesRepo
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
        deps.passwordHasher
    );

    const loginAdmin = new LoginAdmin(
        deps.usersRepo,
        deps.passwordHasher,
        deps.tokenProvider,
        deps.tokenTtl
    );

    const getAdminDashboard = new GetAdminDashboard(
        deps.usersRepo,
        deps.classesRepo,
        deps.enrollmentsRepo,
        deps.financialChargesRepo
    );

    const listSchoolStudents = new ListSchoolStudents(
        deps.coursesRepo,
        deps.classesRepo,
        deps.enrollmentsRepo,
        deps.usersRepo,
        deps.dependentsRepo
    );

    const listAllStudents = new ListAllStudents(deps.enrollmentsRepo);

    const withdrawalsRepo = new SchoolWithdrawalRepositoryAdapter();
    const getAdminSchoolFinancial = new GetAdminSchoolFinancial(
        deps.schoolsRepo,
        deps.financialChargesRepo,
        withdrawalsRepo
    );

    const getAdminSchoolBilling = new GetAdminSchoolBilling(
        deps.schoolsRepo,
        deps.financialChargesRepo
    );

    const listAdminSchoolInvoices = deps.planInvoicesRepo
        ? new ListAdminSchoolInvoices(deps.schoolsRepo, deps.planInvoicesRepo)
        : undefined;

    const listAdminPaymentHistory = deps.planInvoicesRepo
        ? new ListAdminPaymentHistory(deps.planInvoicesRepo)
        : undefined;

    // Use cases de cupons
    const couponsRepo = new DiscountCouponRepositoryAdapter();
    const createDiscountCoupon = new CreateDiscountCoupon(couponsRepo);
    const listDiscountCoupons = new ListDiscountCoupons(couponsRepo);
    const validateDiscountCoupon = new ValidateDiscountCoupon(couponsRepo);

    // Use case para reenviar solicitação de conta Asaas
    const resendSchoolAsaasAccount = deps.asaasProvider
        ? new ResendSchoolAsaasAccount(deps.schoolsRepo, deps.asaasProvider)
        : undefined;

    // Montar router pronto
    const router = adminRouter({
        getAdminStatus,
        listSchoolsWithPlans,
        loginAdmin,
        getAdminDashboard,
        getAdminSchoolDetails,
        getAdminSchoolPlans,
        updateSchool,
        listAdminSubscriptionPlans,
        createSubscriptionPlan,
        updateSubscriptionPlan,
        listAdminCategories,
        createCategory,
        updateCategory,
        createDiscountCoupon,
        listDiscountCoupons,
        validateDiscountCoupon,
        resendSchoolAsaasAccount,
        listSchoolStudents,
        listAllStudents,
        getAdminSchoolFinancial,
        getAdminSchoolBilling,
        listAdminSchoolInvoices,
        listAdminPaymentHistory,
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
        docFiles: ['admin.yaml']
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
        log.warn('[Admin Module] REDIS_HOST não configurado. Jobs e worker não serão iniciados.');
        return;
    }

    try {
        // Agendar todos os jobs repetitivos
        await scheduleAllJobs();
        log.info('[Admin Module] ✓ Jobs agendados com sucesso');

        // Iniciar o worker para processar jobs da fila
        startWorker();
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
