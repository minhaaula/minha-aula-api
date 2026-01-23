import { AsaasProvider } from './asaas-provider';
import type { AsaasProviderPort } from '../../../ports/providers/asaas-port';
import type { PaymentProviderPort } from '../../../ports/providers/payment-provider.port';

/**
 * Factory para criar instâncias de AsaasProvider
 * Centraliza a lógica de criação e configuração
 */
export class AsaasProviderFactory {
    /**
     * Cria um AsaasProvider usando a API key principal (conta master)
     */
    static createMainProvider(): (PaymentProviderPort & Partial<AsaasProviderPort>) | undefined {
        const asaasApiKey = process.env.ASAAS_API_KEY;
        const asaasBaseUrl = process.env.ASAAS_BASE_URL;

        if (!asaasApiKey) {
            return undefined;
        }

        return new AsaasProvider({
            apiKey: asaasApiKey,
            baseUrl: asaasBaseUrl
        }) as PaymentProviderPort & Partial<AsaasProviderPort>;
    }

    /**
     * Cria um AsaasProvider usando a API key de uma subconta (escola)
     */
    static createSubAccountProvider(accountApiKey: string): (PaymentProviderPort & Partial<AsaasProviderPort>) | undefined {
        if (!accountApiKey || !accountApiKey.trim()) {
            return undefined;
        }

        const asaasBaseUrl = process.env.ASAAS_BASE_URL;

        return new AsaasProvider({
            apiKey: accountApiKey.trim(),
            baseUrl: asaasBaseUrl
        }) as PaymentProviderPort & Partial<AsaasProviderPort>;
    }

    /**
     * Cria um AsaasProvider usando uma API key customizada
     */
    static createCustomProvider(apiKey: string, baseUrl?: string): PaymentProviderPort & Partial<AsaasProviderPort> {
        if (!apiKey || !apiKey.trim()) {
            throw new Error('Asaas API key is required');
        }

        return new AsaasProvider({
            apiKey: apiKey.trim(),
            baseUrl: baseUrl || process.env.ASAAS_BASE_URL
        }) as PaymentProviderPort & Partial<AsaasProviderPort>;
    }
}
