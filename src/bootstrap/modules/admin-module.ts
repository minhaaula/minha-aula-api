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
import type { UserRepository } from '../../ports/repositories/user.repo';
import type { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import type { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import type { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import type { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import type { TokenProviderPort } from '../../ports/providers/token-provider.port';
import type { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { ResendSchoolAsaasAccount } from '../../app/use-cases/resend-school-asaas-account';

type AdminModuleDeps = {
    getActiveModules: () => readonly ModuleName[];
    getOpenApiFiles: () => readonly string[];
    getEnvironmentInfo: () => {
        nodeEnv: string | null;
        appModulesEnv: string | null;
    };
    schoolsRepo: SchoolRepository;
    planFinancesRepo: SchoolPlanFinanceRepository;
    usersRepo: UserRepository;
    classesRepo: CourseClassRepository;
    enrollmentsRepo: EnrollmentRepository;
    financialChargesRepo: SchoolFinancialChargeRepository;
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
        createDiscountCoupon,
        listDiscountCoupons,
        validateDiscountCoupon,
        resendSchoolAsaasAccount,
        authMiddleware: ctx.authMiddleware
    });

    return {
        deps: {
            adminRouter: router
        },
        docFiles: ['admin.yaml']
    };
}
