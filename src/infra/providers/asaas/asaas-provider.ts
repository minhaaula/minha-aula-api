import { Money } from '../../../domain/value-objects/money';
import { PaymentProviderPort, CreateChargeInput, CreatePixChargeInput } from '../../../ports/providers/payment-provider.port';
import { AsaasClient } from './asaas-client';
import { AsaasChargeResponse, AsaasSubAccount, CreateAsaasSubAccountInput, CreateAsaasTransferInput, AsaasTransferResponse, AsaasAccountDetails, AsaasAccountBalance } from '../../../ports/providers/asaas-port';
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

    async createPixCharge(input: CreatePixChargeInput): Promise<{ providerRef: string; pixQrCode?: string; pixCopiaECola?: string; invoiceUrl?: string; dueDate: Date; }> {
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
            billingType: 'PIX' as const
        };

        const response = await this.client.createPixCharge(payload);

        return {
            providerRef: response.id,
            pixQrCode: response.pixQrCode,
            pixCopiaECola: response.pixCopiaECola,
            invoiceUrl: response.invoiceUrl,
            dueDate: new Date(response.dueDate)
        };
    }

    async createSubAccount(input: CreateAsaasSubAccountInput): Promise<AsaasSubAccount> {
        // Validação: campos obrigatórios
        if (!input.name || !input.name.trim()) {
            throw new Error('SubAccount name is required');
        }
        if (!input.email || !input.email.trim()) {
            throw new Error('SubAccount email is required');
        }
        if (!input.cpfCnpj || !input.cpfCnpj.trim()) {
            throw new Error('SubAccount CPF/CNPJ is required');
        }
        // Validação: CNPJ deve ter 14 dígitos ou CPF 11 dígitos
        const cpfCnpjDigits = input.cpfCnpj.replace(/\D/g, '');
        if (cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14) {
            throw new Error('SubAccount CPF/CNPJ must have 11 (CPF) or 14 (CNPJ) digits');
        }
        // Validação: incomeValue deve ser positivo
        if (!Number.isFinite(input.incomeValue) || input.incomeValue <= 0) {
            throw new Error('SubAccount incomeValue must be a positive number');
        }
        // Validação: se address está presente, addressNumber e postalCode também devem estar
        if (input.address) {
            if (!input.addressNumber || !input.addressNumber.trim()) {
                throw new Error('SubAccount addressNumber is required when address is provided');
            }
            if (!input.postalCode || !input.postalCode.trim()) {
                throw new Error('SubAccount postalCode is required when address is provided');
            }
            // Validação: CEP deve ter 8 dígitos
            const postalCodeDigits = input.postalCode.replace(/\D/g, '');
            if (postalCodeDigits.length !== 8) {
                throw new Error('SubAccount postalCode must have 8 digits');
            }
        }

        const payload: any = {
            name: input.name,
            email: input.email,
            cpfCnpj: input.cpfCnpj,
            incomeValue: input.incomeValue
        };

        // Adicionar campos opcionais apenas se tiverem valor (conforme documentação do Asaas)
        if (input.birthDate) payload.birthDate = input.birthDate;
        if (input.phone) payload.phone = input.phone;
        if (input.mobilePhone) payload.mobilePhone = input.mobilePhone;
        if (input.companyType) payload.companyType = input.companyType;
        if (input.externalReference) payload.externalReference = input.externalReference;
        if (input.observations) payload.observations = input.observations;
        if (input.additionalEmails) payload.additionalEmails = input.additionalEmails;
        if (input.address) payload.address = input.address;
        if (input.addressNumber) payload.addressNumber = input.addressNumber;
        if (input.complement) payload.complement = input.complement;
        if (input.province) payload.province = input.province;
        if (input.postalCode) payload.postalCode = input.postalCode;
        if (input.municipalInscription) payload.municipalInscription = input.municipalInscription;
        if (input.stateInscription) payload.stateInscription = input.stateInscription;
        
        // Webhooks sempre adicionar se configurado
        const webhooks = input.webhooks ?? this.resolveDefaultWebhooks(input.email);
        if (webhooks) payload.webhooks = webhooks;

        // Log do payload para debug
        console.log('📤 Payload sendo enviado para o Asaas:');
        console.log(JSON.stringify(payload, null, 2));

        const response = await this.client.createSubAccount(payload);
        
        // Validação: verificar se a resposta contém dados essenciais
        if (!response.id || !response.id.trim()) {
            throw new Error('Asaas API returned invalid response: missing account ID');
        }
        if (!response.name || !response.name.trim()) {
            throw new Error('Asaas API returned invalid response: missing account name');
        }
        if (!response.email || !response.email.trim()) {
            throw new Error('Asaas API returned invalid response: missing account email');
        }

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

    async createTransfer(input: CreateAsaasTransferInput): Promise<AsaasTransferResponse> {
        const payload = {
            value: input.amount.amount / 100,
            bankAccount: input.bankAccount,
            bankAccountDigit: input.bankAccountDigit ?? undefined,
            bankAgency: input.bankAgency,
            bankAgencyDigit: input.bankAgencyDigit ?? undefined,
            bankCode: input.bankCode,
            accountType: input.accountType,
            documentHolder: input.documentHolder,
            description: input.description ?? undefined,
            pixKey: input.pixKey ?? undefined
        };

        const response = await this.client.createTransfer(input.accountId, payload);
        return {
            id: response.id,
            status: response.status,
            value: response.value,
            netValue: response.netValue,
            transferFee: response.transferFee,
            effectiveDate: response.effectiveDate ? new Date(response.effectiveDate) : undefined,
            scheduleDate: response.scheduleDate ? new Date(response.scheduleDate) : undefined,
            dateCreated: new Date(response.dateCreated),
            bankAccount: response.bankAccount,
            transactionReceiptUrl: response.transactionReceiptUrl
        };
    }

    async getAccount(accountId: string): Promise<AsaasAccountDetails> {
        if (!accountId || !accountId.trim()) {
            throw new Error('Account ID is required');
        }

        const response = await this.client.getAccount(accountId);
        
        return {
            id: response.id,
            name: response.name,
            email: response.email,
            status: response.status,
            externalReference: response.externalReference ?? null,
            apiKey: response.apiKey,
            walletId: response.walletId,
            onboardingUrl: response.onboardingUrl,
            kycUrl: response.kycUrl
        };
    }

    async getAccountBalance(accountId: string): Promise<AsaasAccountBalance> {
        if (!accountId || !accountId.trim()) {
            throw new Error('Account ID is required');
        }

        return await this.client.getAccountBalance(accountId);
    }

    private resolveDefaultWebhooks(fallbackEmail: string): CreateAsaasSubAccountInput['webhooks'] | undefined {
        const url = process.env.ASAAS_SUBACCOUNT_WEBHOOK_URL?.trim();
        const email = process.env.ASAAS_SUBACCOUNT_WEBHOOK_EMAIL?.trim() || fallbackEmail;
        if (!url) {
            return undefined;
        }

        const webhooks: CreateAsaasSubAccountInput['webhooks'] = [];
        const sendType = (process.env.ASAAS_SUBACCOUNT_WEBHOOK_SEND_TYPE?.trim()?.toUpperCase() === 'SIMULTANEOUSLY')
            ? 'SIMULTANEOUSLY'
            : 'SEQUENTIALLY';
        const authToken = process.env.ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN?.trim() || undefined;
        const apiVersion = Number(process.env.ASAAS_SUBACCOUNT_WEBHOOK_API_VERSION ?? 3) || 3;

        // Webhook de pagamentos
        const paymentEventsEnv = process.env.ASAAS_SUBACCOUNT_WEBHOOK_EVENTS?.trim();
        const paymentEvents = paymentEventsEnv && paymentEventsEnv.length
            ? paymentEventsEnv.split(',').map((event) => event.trim()).filter(Boolean)
            : ['PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];

        webhooks.push({
            name: process.env.ASAAS_SUBACCOUNT_WEBHOOK_NAME?.trim() || 'Webhook para cobranças',
            url: `${url}/payments`,
            email,
            sendType,
            interrupted: false,
            enabled: true,
            apiVersion,
            authToken,
            events: paymentEvents
        });

        // Webhook de contas (se configurado)
        const accountWebhookUrl = process.env.ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_URL?.trim() || url;
        const accountEventsEnv = process.env.ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_EVENTS?.trim();
        const accountEvents = accountEventsEnv && accountEventsEnv.length
            ? accountEventsEnv.split(',').map((event) => event.trim()).filter(Boolean)
            : [
                'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
                'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
                'ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL',
                'ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING',
                'ACCOUNT_CREATED'
            ];

        webhooks.push({
            name: process.env.ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_NAME?.trim() || 'Webhook para contas',
            url: `${accountWebhookUrl}/accounts`,
            email,
            sendType,
            interrupted: false,
            enabled: true,
            apiVersion,
            authToken,
            events: accountEvents
        });

        return webhooks;
    }
}
