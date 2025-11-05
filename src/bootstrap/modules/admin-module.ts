import { ModuleBuildResult, ModuleSetupContext } from './types';
import { adminRouter } from '../../infra/http/routes/admin.routes';
import { GetAdminStatus } from '../../app/use-cases/get-admin-status';
import { ListSchoolsWithPlans } from '../../app/use-cases/list-schools-with-plans';
import type { ModuleName } from '../module-config';
import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';

type AdminModuleDeps = {
    getActiveModules: () => readonly ModuleName[];
    getOpenApiFiles: () => readonly string[];
    getEnvironmentInfo: () => {
        nodeEnv: string | null;
        appModulesEnv: string | null;
    };
    schoolsRepo: SchoolRepository;
    planFinancesRepo: SchoolPlanFinanceRepository;
};

export function buildAdminModule(deps: AdminModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
    const getAdminStatus = new GetAdminStatus(
        () => deps.getActiveModules(),
        () => deps.getOpenApiFiles(),
        () => deps.getEnvironmentInfo()
    );

    const listSchoolsWithPlans = new ListSchoolsWithPlans(
        deps.schoolsRepo,
        deps.planFinancesRepo
    );

    // Montar router pronto
    const router = adminRouter({
        getAdminStatus,
        listSchoolsWithPlans
    });

    return {
        deps: {
            adminRouter: router
        },
        docFiles: ['admin.yaml']
    };
}
