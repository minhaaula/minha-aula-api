import { Money } from '../../../domain/value-objects/money';
import { PaymentProviderPort, CreateChargeInput } from '../../../ports/providers/payment-provider.port';
import { AsaasClient } from './asaas-client';
import { AsaasChargeResponse } from '../../../ports/providers/asaas-port';
import { CreateBoletoChargeInput } from '../../../ports/providers/payment-provider.port';


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

    async createBoletoCharge(input: CreateBoletoChargeInput): Promise<AsaasChargeResponse> {
        const payload = {
            customer: {
                name: input.customer.name,
                email: input.customer.email,
                cpfCnpj: input.customer.cpfCnpj,
                postalCode: input.customer.postalCode,
                addressNumber: input.customer.addressNumber,
                addressComplement: input.customer.addressComplement ?? undefined,
                phone: input.customer.phone ?? undefined
            },
            value: input.amount.amount / 100,
            dueDate: input.dueDate.toISOString().slice(0, 10),
            description: input.description ?? undefined,
            externalReference: input.externalReference ?? undefined,
            metadata: input.metadata,
            billingType: 'BOLETO' as const
        };

        const response = await this.client.createBoletoCharge(payload);

        return {
            providerRef: response.id,
            boletoUrl: response.boletoUrl ?? response.bankSlipUrl ?? response.invoiceUrl,
            barcode: response.bankSlipBarcode,
            digitableLine: response.bankSlipDigitableLine,
            dueDate: new Date(response.dueDate)
        };
    }
}
