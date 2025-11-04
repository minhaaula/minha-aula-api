import type { ModuleName } from '../../bootstrap/module-config';

type EnvironmentInfo = {
    nodeEnv: string | null;
    appModulesEnv: string | null;
};

type ModulesProvider = () => readonly ModuleName[];
type FilesProvider = () => readonly string[];
type EnvironmentProvider = () => EnvironmentInfo;

export class GetAdminStatus {
    constructor(
        private readonly modulesProvider: ModulesProvider,
        private readonly filesProvider: FilesProvider,
        private readonly environmentProvider: EnvironmentProvider
    ) {}

    exec() {
        const modules = this.modulesProvider();
        const files = this.filesProvider();
        const environment = this.environmentProvider();

        return {
            activeModules: [...modules],
            openapiFiles: [...new Set(files)],
            environment,
            uptimeSeconds: Math.round(process.uptime()),
            serverTime: new Date().toISOString()
        };
    }
}
