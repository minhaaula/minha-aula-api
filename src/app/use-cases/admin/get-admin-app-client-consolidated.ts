import type {
    AppClientConsolidatedStats,
    UserAppClientStateRepository
} from '../../../ports/repositories/user-app-client-state.repo';
import { AppError, ErrorCode } from '../../../shared/errors';

export type AdminAppClientConsolidatedOutput = AppClientConsolidatedStats & {
    /** Ex.: `1.2.3 (20), 1.4.5 (33)` */
    appVersionsLabel: string;
    /** Ex.: `Android: 120, iOS: 85` */
    byPlatformLabel: string;
    osVersionsLabels: {
        ANDROID: string;
        IOS: string;
    };
};

function formatVersionLabel(appVersion: string, count: number): string {
    return `${appVersion} (${count})`;
}

export class GetAdminAppClientConsolidated {
    constructor(private readonly appClientState: UserAppClientStateRepository) {}

    async exec(): Promise<AdminAppClientConsolidatedOutput> {
        const getStats = this.appClientState.getConsolidatedStats;
        if (!getStats) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message: 'Consolidação do app do aluno não está disponível'
            });
        }

        const stats = await getStats.call(this.appClientState);

        return {
            ...stats,
            appVersionsLabel: stats.appVersions
                .map((item) => formatVersionLabel(item.appVersion, item.count))
                .join(', '),
            byPlatformLabel: `Android: ${stats.byPlatform.ANDROID}, iOS: ${stats.byPlatform.IOS}`,
            osVersionsLabels: {
                ANDROID: stats.osVersionsByPlatform.ANDROID.map((item) =>
                    formatVersionLabel(item.osVersion, item.count)
                ).join(', '),
                IOS: stats.osVersionsByPlatform.IOS.map((item) =>
                    formatVersionLabel(item.osVersion, item.count)
                ).join(', ')
            }
        };
    }
}
