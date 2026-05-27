import { describe, expect, it } from 'vitest';
import { presentAdminStudentAppClient } from '../../src/app/use-cases/admin/get-admin-student-details';
import type { UserAppClientStateRecord } from '../../src/ports/repositories/user-app-client-state.repo';

describe('presentAdminStudentAppClient', () => {
    const record: UserAppClientStateRecord = {
        userId: 'user-1',
        platform: 'ANDROID',
        appVersion: '2.1.3',
        osVersion: 'Android 14',
        notificationsEnabled: false,
        lastSeenAt: new Date('2026-05-20T12:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date()
    };

    it('mapeia registro do app para a resposta admin', () => {
        expect(presentAdminStudentAppClient(record)).toEqual({
            platform: 'ANDROID',
            appVersion: '2.1.3',
            osVersion: 'Android 14',
            notificationsEnabled: false,
            lastSeenAt: record.lastSeenAt
        });
    });

    it('retorna null sem registro', () => {
        expect(presentAdminStudentAppClient(null)).toBeNull();
    });
});
