import { Money } from '../../../domain/value-objects/money';
import { PaymentProviderPort, CreateChargeInput } from '../../../ports/providers/payment-provider.port';
import { AsaasClient } from './asaas-client';


export class AsaasProvider implements PaymentProviderPort {
    private client: AsaasClient;

    constructor({ apiKey, baseUrl }: { apiKey: string; baseUrl?: string }) {
        this.client = new AsaasClient(apiKey, baseUrl);
    }

    authorize(input: CreateChargeInput): Promise<{ providerRef: string; }> {
        throw new Error('Method not implemented.');
    }

    capture(providerRef: string, amount?: Money): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
