import { ModuleBuildResult, ModuleSetupContext } from './types';
import { adminRouter } from '../../infra/http/routes/admin.routes';
import { GetAdminStatus } from '../../app/use-cases/get-admin-status';
import type { ModuleName } from '../module-config';

type AdminModuleDeps = {
    getActiveModules: () => readonly ModuleName[];
    getOpenApiFiles: () => readonly string[];
    getEnvironmentInfo: () => {
        nodeEnv: string | null;
        appModulesEnv: string | null;
    };
};

export function buildAdminModule(deps: AdminModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
    const getAdminStatus = new GetAdminStatus(
        () => deps.getActiveModules(),
        () => deps.getOpenApiFiles(),
        () => deps.getEnvironmentInfo()
    );

    // Montar router pronto
    const router = adminRouter({
        getAdminStatus
    });

    return {
        deps: {
            adminRouter: router
        },
        docFiles: ['admin.yaml']
    };
}
