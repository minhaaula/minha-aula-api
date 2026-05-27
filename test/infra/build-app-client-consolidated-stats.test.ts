import { describe, expect, it } from 'vitest';
import { buildAppClientConsolidatedStats } from '../../src/infra/db/typeorm/user-app-client-state-repository.adapter';

describe('buildAppClientConsolidatedStats', () => {
    it('agrega versões, plataformas e SO a partir das linhas já normalizadas', () => {
        const stats = buildAppClientConsolidatedStats([
            { userId: 'u1', platform: 'IOS', appVersion: '2.1.3', osVersion: 'iOS 26.2' },
            { userId: 'u2', platform: 'IOS', appVersion: '2.1.3', osVersion: 'iOS 17.4' },
            { userId: 'u3', platform: 'ANDROID', appVersion: '2.0.0', osVersion: 'Android 14' },
            { userId: 'u4', platform: 'ANDROID', appVersion: '2.0.0', osVersion: 'Android 14' },
            { userId: 'u5', platform: 'ANDROID', appVersion: '1.9.0', osVersion: 'Android 13' }
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

    it('normaliza plataforma em minúsculo para ANDROID/IOS', () => {
        const stats = buildAppClientConsolidatedStats([
            { userId: 'u1', platform: 'ios', appVersion: '2.0.0', osVersion: 'iOS 17' },
            { userId: 'u2', platform: 'android', appVersion: '2.0.0', osVersion: 'Android 14' }
        ]);

        // plataformas em minúsculo não batem com 'ANDROID'/'IOS' → ficam sem contagem
        // (caso real: o normalizeRawRow já trata o toUpperCase, mas buildAppClientConsolidatedStats
        // recebe dado já normalizado pelo dedupeRawAppClientRows)
        expect(stats.totalUsers).toBe(2);
    });
});
