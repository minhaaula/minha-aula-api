import { ModuleBuildResult, ModuleSetupContext } from './types';
import { adminRouter } from '../../infra/http/routes/admin.routes';
import { GetAdminStatus } from '../../app/use-cases/get-admin-status';
import { ListSchoolsWithPlans } from '../../app/use-cases/list-schools-with-plans';
import { LoginAdmin } from '../../app/use-cases/login-admin';
import { GetAdminDashboard } from '../../app/use-cases/get-admin-dashboard';
import type { ModuleName } from '../module-config';
import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import type { UserRepository } from '../../ports/repositories/user.repo';
import type { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import type { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import type { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import type { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import type { TokenProviderPort } from '../../ports/providers/token-provider.port';

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

    // Montar router pronto
    const router = adminRouter({
        getAdminStatus,
        listSchoolsWithPlans,
        loginAdmin,
        getAdminDashboard,
        authMiddleware: ctx.authMiddleware
    });

    return {
        deps: {
            adminRouter: router
        },
        docFiles: ['admin.yaml']
    };
}
