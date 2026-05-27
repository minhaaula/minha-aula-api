import { describe, expect, it } from 'vitest';
import { parseLoginAppClient } from '../../../src/infra/http/validators/app-client-schemas';

describe('parseLoginAppClient', () => {
    it('aceita campos planos no body', () => {
        const parsed = parseLoginAppClient({
            platform: 'android',
            appVersion: '2.1.3',
            osVersion: 'Android 14',
            notificationsEnabled: true
        });

        expect(parsed).toEqual({
            platform: 'ANDROID',
            appVersion: '2.1.3',
            osVersion: 'Android 14',
            notificationsEnabled: true
        });
    });

    it('aceita bloco aninhado appClient', () => {
        const parsed = parseLoginAppClient({
            cpf: '12345678909',
            password: 'senha12345',
            appClient: {
                platform: 'IOS',
                appVersion: '1.0.0',
                osVersion: 'iOS 17.4',
                notificationsEnabled: 'true'
            }
        });

        expect(parsed).toEqual({
            platform: 'IOS',
            appVersion: '1.0.0',
            osVersion: 'iOS 17.4',
            notificationsEnabled: true
        });
    });

    it('aceita snake_case', () => {
        const parsed = parseLoginAppClient({
            appClient: {
                platform: 'ANDROID',
                app_version: '3.0.1',
                os_version: 'Android 15',
                notifications_enabled: 1
            }
        });

        expect(parsed?.appVersion).toBe('3.0.1');
        expect(parsed?.notificationsEnabled).toBe(true);
    });

    it('aceita payload do app sem notificationsEnabled (default false)', () => {
        const parsed = parseLoginAppClient({
            cpf: '39588620805',
            password: 'teste@123',
            platform: 'IOS',
            appVersion: '2.1.3',
            osVersion: 'iOS 26.2'
        });

        expect(parsed).toEqual({
            platform: 'IOS',
            appVersion: '2.1.3',
            osVersion: 'iOS 26.2',
            notificationsEnabled: false
        });
    });

    it('retorna undefined quando nenhum metadado é enviado', () => {
        expect(parseLoginAppClient({ cpf: '1', password: 'x' })).toBeUndefined();
    });

    it('rejeita metadados parciais', () => {
        expect(() =>
            parseLoginAppClient({
                platform: 'ANDROID',
                appVersion: '1.0.0'
            })
        ).toThrow();
    });
});
