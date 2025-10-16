import { Money } from '../../../domain/value-objects/money';
import { PaymentProviderPort, CreateChargeInput } from '../../../ports/providers/payment-provider.port';
import { AsaasClient } from './asaas-client';
import { AsaasChargeResponse, AsaasSubAccount, CreateAsaasSubAccountInput } from '../../../ports/providers/asaas-port';
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

    async createSubAccount(input: CreateAsaasSubAccountInput): Promise<AsaasSubAccount> {
        const payload = {
            name: input.name,
            email: input.email,
            cpfCnpj: input.cpfCnpj,
            birthDate: input.birthDate ?? undefined,
            phone: input.phone ?? undefined,
            mobilePhone: input.mobilePhone ?? undefined,
            companyType: input.companyType ?? undefined,
            incomeValue: input.incomeValue,
            externalReference: input.externalReference ?? undefined,
            observations: input.observations ?? undefined,
            additionalEmails: input.additionalEmails ?? undefined,
            address: input.address ?? undefined,
            addressNumber: input.addressNumber ?? undefined,
            complement: input.complement ?? undefined,
            province: input.province ?? undefined,
            postalCode: input.postalCode ?? undefined,
            municipalInscription: input.municipalInscription ?? undefined,
            stateInscription: input.stateInscription ?? undefined,
            webhooks: input.webhooks ?? this.resolveDefaultWebhooks(input.email)
        };

        const response = await this.client.createSubAccount(payload);
        console.log(response)
        return {
            id: response.id,
            name: response.name,
            email: response.email,
            status: response.status,
            externalReference: response.externalReference ?? null,
            apiKey: response.apiKey,
            walletId: response.walletId
        };
    }

    private resolveDefaultWebhooks(fallbackEmail: string): CreateAsaasSubAccountInput['webhooks'] | undefined {
        const url = process.env.ASAAS_SUBACCOUNT_WEBHOOK_URL?.trim();
        const email = process.env.ASAAS_SUBACCOUNT_WEBHOOK_EMAIL?.trim() || fallbackEmail;
        if (!url) {
            return undefined;
        }

        const name = process.env.ASAAS_SUBACCOUNT_WEBHOOK_NAME?.trim() || 'Webhook para cobranças';
        const sendType = (process.env.ASAAS_SUBACCOUNT_WEBHOOK_SEND_TYPE?.trim()?.toUpperCase() === 'SIMULTANEOUSLY')
            ? 'SIMULTANEOUSLY'
            : 'SEQUENTIALLY';
        const authToken = process.env.ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN?.trim() || undefined;
        const eventsEnv = process.env.ASAAS_SUBACCOUNT_WEBHOOK_EVENTS?.trim();
        const events = eventsEnv && eventsEnv.length
            ? eventsEnv.split(',').map((event) => event.trim()).filter(Boolean)
            : ['PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];

        return [{
            name,
            url,
            email,
            sendType,
            interrupted: false,
            enabled: true,
            apiVersion: Number(process.env.ASAAS_SUBACCOUNT_WEBHOOK_API_VERSION ?? 3) || 3,
            authToken,
            events
        }];
    }
}
