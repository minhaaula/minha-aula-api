import { describe, expect, it } from 'vitest';
import { validateAsaasWebhookTokenConfig } from '../../src/bootstrap/modules';

describe('validateAsaasWebhookTokenConfig', () => {
    it('does not require ASAAS_WEBHOOK_TOKEN in production when schools module is NOT active', () => {
        expect(() => {
            validateAsaasWebhookTokenConfig({
                selected: ['auth'],
                nodeEnv: 'production',
                asaasWebhookToken: undefined,
                authTokenSecret: 'a'.repeat(32)
            });
        }).not.toThrow();
    });

    it('requires ASAAS_WEBHOOK_TOKEN in production when schools module IS active', () => {
        expect(() => {
            validateAsaasWebhookTokenConfig({
                selected: ['schools'],
                nodeEnv: 'production',
                asaasWebhookToken: undefined,
                authTokenSecret: 'a'.repeat(32)
            });
        }).toThrow(/ASAAS_WEBHOOK_TOKEN é obrigatório em produção quando o módulo schools está ativo/);
    });

    it('does not require ASAAS_WEBHOOK_TOKEN outside production (even when schools is active)', () => {
        expect(() => {
            validateAsaasWebhookTokenConfig({
                selected: ['schools'],
                nodeEnv: 'development',
                asaasWebhookToken: undefined,
                authTokenSecret: 'a'.repeat(32)
            });
        }).not.toThrow();
    });

    it('throws when ASAAS_WEBHOOK_TOKEN equals AUTH_TOKEN_SECRET (when schools is active)', () => {
        const secret = 'b'.repeat(32);
        expect(() => {
            validateAsaasWebhookTokenConfig({
                selected: ['schools'],
                nodeEnv: 'production',
                asaasWebhookToken: secret,
                authTokenSecret: secret
            });
        }).toThrow(/CRITICAL SECURITY ERROR/);
    });

    it('does not check token equality when schools module is NOT active', () => {
        const secret = 'c'.repeat(32);
        expect(() => {
            validateAsaasWebhookTokenConfig({
                selected: ['auth'],
                nodeEnv: 'production',
                asaasWebhookToken: secret,
                authTokenSecret: secret
            });
        }).not.toThrow();
    });
});

