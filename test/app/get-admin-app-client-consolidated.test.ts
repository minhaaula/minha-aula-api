import { describe, expect, it } from 'vitest';
import { GetAdminAppClientConsolidated } from '../../src/app/use-cases/admin/get-admin-app-client-consolidated';
import type {
    AppClientConsolidatedStats,
    UserAppClientStateRepository
} from '../../src/ports/repositories/user-app-client-state.repo';

class InMemoryAppClientState implements Pick<UserAppClientStateRepository, 'getConsolidatedStats'> {
    constructor(private readonly stats: AppClientConsolidatedStats) {}

    async getConsolidatedStats() {
        return this.stats;
    }
}

describe('GetAdminAppClientConsolidated', () => {
    it('monta labels consolidados de versão, plataforma e SO', async () => {
        const useCase = new GetAdminAppClientConsolidated(
            new InMemoryAppClientState({
                totalUsers: 53,
                appVersions: [
                    { appVersion: '1.4.5', count: 33 },
                    { appVersion: '1.2.3', count: 20 }
                ],
                byPlatform: { ANDROID: 30, IOS: 23 },
                osVersionsByPlatform: {
                    ANDROID: [
                        { osVersion: 'Android 14', count: 25 },
                        { osVersion: 'Android 13', count: 5 }
                    ],
                    IOS: [{ osVersion: 'iOS 17.4', count: 23 }]
                }
            }) as UserAppClientStateRepository
        );

        const result = await useCase.exec();

        expect(result.totalUsers).toBe(53);
        expect(result.appVersionsLabel).toBe('1.4.5 (33), 1.2.3 (20)');
        expect(result.byPlatformLabel).toBe('Android: 30, iOS: 23');
        expect(result.byPlatform).toEqual({ ANDROID: 30, IOS: 23 });
        expect(result.osVersionsLabels.ANDROID).toBe('Android 14 (25), Android 13 (5)');
        expect(result.osVersionsLabels.IOS).toBe('iOS 17.4 (23)');
    });
});
