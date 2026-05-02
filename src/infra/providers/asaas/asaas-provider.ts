import { Money } from '../../../domain/value-objects/money';
import { PaymentProviderPort, CreateChargeInput, CreatePixChargeInput } from '../../../ports/providers/payment-provider.port';
import { AsaasClient } from './asaas-client';
import {
    AsaasChargeResponse,
    AsaasSubAccount,
    CreateAsaasSubAccountInput,
    CreateAsaasTransferInput,
    AsaasTransferResponse,
    AsaasAccountDetails,
    AsaasAccountBalance,
    AsaasPaymentDetails,
    ListAsaasPaymentsParams,
    ListAsaasPaymentsResponse,
    AsaasPendingDocumentsResult,
    AsaasPendingDocumentGroup,
    AsaasAccountStatus,
    AsaasPixQrCodeResponse,
    AsaasReceivingBankAccountInput,
    AsaasReceivingBankAccountResult
} from '../../../ports/providers/asaas-port';
import { CreateBoletoChargeInput } from '../../../ports/providers/payment-provider.port';
import { log } from '../../../shared/logger';

export class AsaasProvider implements PaymentProviderPort {
    private client: AsaasClient;

    constructor({ apiKey, baseUrl }: { apiKey: string; baseUrl?: string }) {
        this.client = new AsaasClient(apiKey, baseUrl);
    }

    /**
     * Por padrão o Asaas **não** deve enviar e-mail/SMS automáticos ao pagador nem à subconta (Minha Aula usa app/e-mail próprio e webhooks).
     * `ASAAS_NOTIFY_CUSTOMER_ON_PAYMENT=true` reativa notificações nativas Asaas para pagadores e para criação de subconta.
     */
    private static asaasNotifyCustomerEnabled(): boolean {
        return process.env.ASAAS_NOTIFY_CUSTOMER_ON_PAYMENT === 'true';
    }

    /**
     * Flags no objeto `customer` em POST /payments (cliente embutido na cobrança).
     */
    private static asaasCustomerNotificationFlags(): { notificationDisabled?: boolean } {
        if (AsaasProvider.asaasNotifyCustomerEnabled()) {
            return {};
        }
        return { notificationDisabled: true };
    }

    /**
     * Clientes já existentes no Asaas (mesmo CPF/CNPJ) podem manter notificações ativas mesmo com `notificationDisabled`
     * no payload aninhado. Após criar a cobrança, forçamos PUT /customers/{id} quando aplicável.
     */
    private async ensurePayerCustomerNotificationsDisabled(customerId: unknown): Promise<void> {
        if (AsaasProvider.asaasNotifyCustomerEnabled()) return;
        const id =
            typeof customerId === 'string'
                ? customerId.trim()
                : customerId && typeof customerId === 'object' && typeof (customerId as { id?: unknown }).id === 'string'
                  ? String((customerId as { id: string }).id).trim()
                  : '';
        if (!id) return;
        try {
            await this.client.updateCustomer(id, { notificationDisabled: true });
        } catch (e) {
            log.warn('[Asaas] Falha ao desativar notificações do cliente (pagador); cobrança já foi criada', {
                customerId: id,
                error: e instanceof Error ? e.message : String(e)
            });
        }
    }

    /**
     * Normaliza telefone para formato de celular brasileiro (11 dígitos: DDD + 9 + 8 dígitos).
     * Asaas exige "número móvel válido".
     * - 10 dígitos (DDD + 8): insere 9 após o DDD.
     * - 11 dígitos com 3º dígito !== 9: trata como DDD + 8 + 1 sobrando e insere 9 (ex.: 12283727727 → 12928372727).
     */
    private normalizeToBrazilianMobile(raw: string): string {
        const digits = raw.replace(/\D/g, '');
        if (digits.length === 10) {
            return digits.slice(0, 2) + '9' + digits.slice(2);
        }
        if (digits.length >= 11 && digits[2] !== '9') {
            return digits.slice(0, 2) + '9' + digits.slice(2, 10);
        }
        if (digits.length >= 11) {
            return digits.slice(0, 11);
        }
        return digits;
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
                phone: input.customer.phone ?? undefined,
                ...AsaasProvider.asaasCustomerNotificationFlags()
            },
            value: input.amount.amount / 100,
            dueDate: input.dueDate.toISOString().slice(0, 10),
            description: input.description ?? undefined,
            externalReference: input.externalReference ?? undefined,
            metadata: input.metadata,
            billingType: 'BOLETO' as const
        };

        const response = await this.client.createBoletoCharge(payload);
        await this.ensurePayerCustomerNotificationsDisabled(response.customer);

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
                phone: input.customer.phone ?? undefined,
                ...AsaasProvider.asaasCustomerNotificationFlags()
            },
            value: input.amount.amount / 100,
            dueDate: input.dueDate.toISOString().slice(0, 10),
            description: input.description ?? undefined,
            externalReference: input.externalReference ?? undefined,
            metadata: input.metadata,
            billingType: 'PIX' as const
        };

        const response = await this.client.createPixCharge(payload);
        await this.ensurePayerCustomerNotificationsDisabled(response.customer);

        return {
            providerRef: response.id,
            pixQrCode: response.pixQrCode,
            pixCopiaECola: response.pixCopiaECola,
            invoiceUrl: response.invoiceUrl,
            dueDate: new Date(response.dueDate)
        };
    }

    async getPixQrCode(paymentId: string): Promise<AsaasPixQrCodeResponse> {
        return await this.client.getPixQrCode(paymentId);
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

        // Asaas exige mobilePhone em formato de celular válido (BR: DDD + 9 + 8 dígitos = 11 dígitos).
        // Se vier só fixo (10 dígitos: DDD + 8), normalizamos inserindo 9 após o DDD.
        const rawPhone = (input.mobilePhone ?? input.phone ?? '').toString().trim();
        if (!rawPhone || rawPhone.replace(/\D/g, '').length < 10) {
            throw new Error('SubAccount mobilePhone is required (min 10 digits)');
        }
        const mobilePhone = this.normalizeToBrazilianMobile(rawPhone);

        const payload: any = {
            name: input.name,
            email: input.email,
            cpfCnpj: input.cpfCnpj,
            mobilePhone,
            incomeValue: input.incomeValue
        };

        // Campos obrigatórios para criação de subconta (documentação Asaas AccountSaveRequestDTO)
        if (input.address) payload.address = input.address;
        if (input.addressNumber) payload.addressNumber = input.addressNumber;
        if (input.province) payload.province = input.province;
        if (input.postalCode) payload.postalCode = input.postalCode;

        // Adicionar campos opcionais
        if (input.birthDate) payload.birthDate = input.birthDate;
        if (input.phone) payload.phone = input.phone;
        if (input.companyType) payload.companyType = input.companyType;
        if (input.externalReference) payload.externalReference = input.externalReference;
        if (input.observations) payload.observations = input.observations;
        if (input.additionalEmails) payload.additionalEmails = input.additionalEmails;
        if (input.complement) payload.complement = input.complement;
        if (input.municipalInscription) payload.municipalInscription = input.municipalInscription;
        if (input.stateInscription) payload.stateInscription = input.stateInscription;

        // Mesma política dos pagadores: sem notificações automáticas (e-mail/SMS) do Asaas para a subconta
        if (!AsaasProvider.asaasNotifyCustomerEnabled()) {
            payload.notificationDisabled = true;
        }

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

    async getMainAccountBalance(): Promise<{ balance: number }> {
        return await this.client.getMainAccountBalance();
    }

    async getPayment(paymentId: string): Promise<AsaasPaymentDetails> {
        if (!paymentId || !paymentId.trim()) {
            throw new Error('Payment ID is required');
        }

        return await this.client.getPayment(paymentId);
    }

    async deletePayment(paymentId: string): Promise<{ deleted: boolean; id: string }> {
        if (!paymentId || !paymentId.trim()) {
            throw new Error('Payment ID is required');
        }
        return await this.client.deletePayment(paymentId);
    }

    async receivePaymentInCash(
        paymentId: string,
        payload: { paymentDate: string; value: number; notifyCustomer?: boolean }
    ): Promise<void> {
        if (!paymentId || !paymentId.trim()) throw new Error('Payment ID is required');
        await this.client.receivePaymentInCash(paymentId, payload);
    }

    async listPayments(params?: ListAsaasPaymentsParams): Promise<ListAsaasPaymentsResponse> {
        return await this.client.listPayments(params);
    }

    async getOnboardingUrl(accountApiKey: string): Promise<string | null> {
        if (!accountApiKey?.trim()) return null;
        return this.client.getMyAccountOnboardingUrl(accountApiKey);
    }

    async getPendingDocuments(accountApiKey: string): Promise<AsaasPendingDocumentsResult> {
        if (!accountApiKey?.trim()) {
            return { rejectReasons: null, data: [] };
        }
        try {
            const raw = await this.client.getMyAccountDocuments(accountApiKey);
            const data: AsaasPendingDocumentGroup[] = raw.data.map((item: Record<string, unknown>) => ({
                id: String(item.id ?? ''),
                status: String(item.status ?? ''),
                type: String(item.type ?? ''),
                title: String(item.title ?? ''),
                description: String(item.description ?? ''),
                onboardingUrl: typeof item.onboardingUrl === 'string' && item.onboardingUrl.trim() ? item.onboardingUrl : null,
                onboardingUrlExpirationDate: typeof item.onboardingUrlExpirationDate === 'string' ? item.onboardingUrlExpirationDate : null,
                responsible: item.responsible as AsaasPendingDocumentGroup['responsible'],
                documents: Array.isArray(item.documents) ? item.documents.map((d: Record<string, unknown>) => ({ id: String(d.id ?? ''), status: String(d.status ?? '') })) : undefined
            }));
            return { rejectReasons: raw.rejectReasons, data };
        } catch {
            return { rejectReasons: null, data: [] };
        }
    }

    async uploadDocument(accountApiKey: string, documentGroupId: string, fileBuffer: Buffer, mimeType: string, type: string): Promise<void> {
        if (!accountApiKey?.trim()) throw new Error('accountApiKey is required');
        if (!documentGroupId?.trim()) throw new Error('documentGroupId is required');
        if (!type?.trim()) throw new Error('type is required');
        await this.client.uploadMyAccountDocument(accountApiKey, documentGroupId, fileBuffer, mimeType, type);
    }

    async getAccountStatus(accountApiKey: string): Promise<AsaasAccountStatus | null> {
        if (!accountApiKey?.trim()) return null;
        try {
            return await this.client.getMyAccountStatus(accountApiKey);
        } catch {
            return null;
        }
    }

    async createReceivingBankAccount(
        accountApiKey: string,
        input: AsaasReceivingBankAccountInput
    ): Promise<AsaasReceivingBankAccountResult> {
        if (!accountApiKey?.trim()) {
            throw new Error('accountApiKey is required');
        }
        const bankCode = input.bankCode.replace(/\D/g, '').padStart(3, '0').slice(-3);
        if (bankCode.length !== 3) {
            throw new Error('bankCode must be a valid 3-digit bank code');
        }
        const bankAccountType = input.bankAccountType === 'POUPANCA' ? 'CONTA_POUPANCA' : 'CONTA_CORRENTE';
        const payload: Record<string, unknown> = {
            bank: bankCode,
            accountName: input.bankName,
            name: input.ownerName,
            cpfCnpj: input.cpfCnpjDigits.replace(/\D/g, ''),
            agency: input.agency.replace(/\D/g, '') || input.agency,
            account: input.account.replace(/\D/g, '') || input.account,
            accountDigit: (input.accountDigit ?? '').replace(/\D/g, '') || '',
            bankAccountType
        };
        const agencyDigits = (input.agencyDigit ?? '').replace(/\D/g, '');
        if (agencyDigits) {
            payload.agencyDigit = agencyDigits;
        }
        return this.client.postBankAccountsWithAccessToken(accountApiKey, payload);
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

        // Webhook de pagamentos: inclui ciclo completo (criação, alteração, confirmação, recebimento, atraso, cancelamento, estorno, chargeback).
        const paymentEventsEnv = process.env.ASAAS_SUBACCOUNT_WEBHOOK_EVENTS?.trim();
        const paymentEvents = paymentEventsEnv && paymentEventsEnv.length
            ? paymentEventsEnv.split(',').map((event) => event.trim()).filter(Boolean)
            : [
                'PAYMENT_CREATED',
                'PAYMENT_UPDATED',
                'PAYMENT_CONFIRMED',
                'PAYMENT_RECEIVED',
                'PAYMENT_OVERDUE',
                'PAYMENT_DELETED',
                'PAYMENT_REFUNDED',
                'PAYMENT_REFUND_IN_PROGRESS',
                'PAYMENT_CHARGEBACK_REQUESTED',
                'PAYMENT_CHARGEBACK_DISPUTE',
                'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
                'PAYMENT_RECEIVED_IN_CASH_UNDONE',
                'PAYMENT_BANK_SLIP_CANCELLED'
            ];

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

        // Webhook de contas: cobre todas as etapas do KYC (white-label) — informações comerciais, conta bancária, documentação e aprovação geral.
        const accountWebhookUrl = process.env.ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_URL?.trim() || url;
        const accountEventsEnv = process.env.ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_EVENTS?.trim();
        const accountEvents = accountEventsEnv && accountEventsEnv.length
            ? accountEventsEnv.split(',').map((event) => event.trim()).filter(Boolean)
            : [
                'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
                'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
                'ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL',
                'ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING',
                'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED',
                'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL',
                'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING',
                'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED',
                'ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED',
                'ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL',
                'ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING',
                'ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED',
                'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON',
                'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED',
                'ACCOUNT_STATUS_DOCUMENT_APPROVED',
                'ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL',
                'ACCOUNT_STATUS_DOCUMENT_PENDING',
                'ACCOUNT_STATUS_DOCUMENT_REJECTED'
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

        // Webhook de transferências (saques): permite ao backend acompanhar TRANSFER_DONE/FAILED e atualizar
        // o status do `school_withdrawals` (a chamada síncrona pode retornar PENDING/IN_BANK_PROCESSING).
        const transferWebhookUrl = process.env.ASAAS_SUBACCOUNT_TRANSFER_WEBHOOK_URL?.trim() || url;
        const transferEventsEnv = process.env.ASAAS_SUBACCOUNT_TRANSFER_WEBHOOK_EVENTS?.trim();
        const transferEvents = transferEventsEnv && transferEventsEnv.length
            ? transferEventsEnv.split(',').map((event) => event.trim()).filter(Boolean)
            : [
                'TRANSFER_CREATED',
                'TRANSFER_PENDING',
                'TRANSFER_IN_BANK_PROCESSING',
                'TRANSFER_BLOCKED',
                'TRANSFER_DONE',
                'TRANSFER_FAILED',
                'TRANSFER_CANCELLED'
            ];

        webhooks.push({
            name: process.env.ASAAS_SUBACCOUNT_TRANSFER_WEBHOOK_NAME?.trim() || 'Webhook para transferências',
            url: `${transferWebhookUrl}/transfers`,
            email,
            sendType,
            interrupted: false,
            enabled: true,
            apiVersion,
            authToken,
            events: transferEvents
        });

        return webhooks;
    }

    /**
     * Lista subcontas pelo e-mail (GET /v3/accounts?email=).
     * Útil quando o POST /v3/accounts retorna "email já em uso" e precisamos vincular a conta existente.
     */
    async listAccountsByEmail(email: string): Promise<AsaasSubAccount[]> {
        const normalized = email?.trim();
        if (!normalized) return [];
        try {
            const accounts = await this.client.listAccountsByEmail(normalized);
            return accounts.map((acc) => ({
                id: acc.id,
                name: acc.name,
                email: acc.email,
                status: acc.status,
                externalReference: acc.externalReference ?? null,
                apiKey: acc.apiKey,
                walletId: acc.walletId
            }));
        } catch (err) {
            log.warn('[Asaas] listAccountsByEmail falhou', {
                email: normalized,
                error: err instanceof Error ? err.message : String(err)
            });
            return [];
        }
    }
}
