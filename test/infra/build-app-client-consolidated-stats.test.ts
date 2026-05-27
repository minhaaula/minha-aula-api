import { describe, expect, it } from 'vitest';
import { buildAppClientConsolidatedStats } from '../../src/infra/db/typeorm/user-app-client-state-repository.adapter';

describe('buildAppClientConsolidatedStats', () => {
    it('agrega versões, plataformas e SO a partir das linhas da tabela', () => {
        const stats = buildAppClientConsolidatedStats([
            { platform: 'IOS', appVersion: '2.1.3', osVersion: 'iOS 26.2' },
            { platform: 'IOS', appVersion: '2.1.3', osVersion: 'iOS 17.4' },
            { platform: 'ANDROID', appVersion: '2.0.0', osVersion: 'Android 14' },
            { platform: 'ANDROID', appVersion: '2.0.0', osVersion: 'Android 14' },
            { platform: 'ANDROID', appVersion: '1.9.0', osVersion: 'Android 13' }
        ]);

        expect(stats.totalUsers).toBe(5);
        expect(stats.appVersions).toEqual([
            { appVersion: '2.0.0', count: 2 },
            { appVersion: '2.1.3', count: 2 },
            { appVersion: '1.9.0', count: 1 }
        ]);
        expect(stats.byPlatform).toEqual({ ANDROID: 3, IOS: 2 });
        expect(stats.osVersionsByPlatform.ANDROID).toEqual([
            { osVersion: 'Android 14', count: 2 },
            { osVersion: 'Android 13', count: 1 }
        ]);
        expect(stats.osVersionsByPlatform.IOS).toEqual([
            { osVersion: 'iOS 17.4', count: 1 },
            { osVersion: 'iOS 26.2', count: 1 }
        ]);
    });

    it('retorna estrutura vazia quando não há registros', () => {
        const stats = buildAppClientConsolidatedStats([]);

        expect(stats.totalUsers).toBe(0);
        expect(stats.appVersions).toEqual([]);
        expect(stats.byPlatform).toEqual({ ANDROID: 0, IOS: 0 });
        expect(stats.osVersionsByPlatform).toEqual({ ANDROID: [], IOS: [] });
    });
});
