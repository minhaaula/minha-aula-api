import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceStatus, SchoolPlanInvoice } from '../../domain/entities/school-plan-invoice';
import { SchoolPlanStatus } from '../../domain/entities/school-plan-finance';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';

type AsaasPaymentPayload = {
    id: string;
    status?: string | null;
    externalReference?: string | null;
    paymentDate?: string | null;
    confirmedDate?: string | null;
    receivedDate?: string | null;
    dueDate?: string | null;
    customer?: { id?: string | null } | null;
    value?: number | null;
    /** Metadata enviada na criação da cobrança (schoolId, planId, financeId) — usada para validar que o invoice é da escola correta. */
    metadata?: Record<string, string> | null;
};

type HandleAsaasPaymentWebhookInput = {
    event: string;
    payment?: AsaasPaymentPayload | null;
    eventId?: string | null; // ID do evento do Asaas para idempotência
};

type HandleAsaasPaymentWebhookOutput = {
    handled: boolean;
    reason?: string;
};

const SUCCESS_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const SUCCESS_STATUSES = new Set(['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED']);
const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE']);
const OVERDUE_STATUSES = new Set(['OVERDUE']);
const CANCELLED_EVENTS = new Set(['PAYMENT_DELETED', 'PAYMENT_CANCELED', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'REFUNDED', 'CHARGEBACK']);

export class HandleAsaasPaymentWebhook {
    constructor(
        private readonly invoices: SchoolPlanInvoiceRepository,
        private readonly finances: SchoolPlanFinanceRepository,
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: HandleAsaasPaymentWebhookInput): Promise<HandleAsaasPaymentWebhookOutput> {
        const eventName = input.event?.toUpperCase?.() ?? '';
        const payment = input.payment;

        if (!payment || typeof payment.id !== 'string') {
            return { handled: false, reason: 'Missing payment payload' };
        }

        // Busca do invoice: sempre por provider_ref (id do pagamento) primeiro; fallback por externalReference.
        // O invoice guarda schoolId de forma única — toda a baixa e dados de subconta usam somente a escola do invoice.
        const providerRef = payment.id.trim();
        let invoice = await this.invoices.findByProviderRef(providerRef);
        if (!invoice && payment.externalReference) {
            invoice = await this.invoices.findByExternalReference(payment.externalReference);
        }

        if (!invoice) {
            return { handled: false, reason: 'Invoice not found' };
        }

        // Garantir que o invoice é da escola do pagamento quando o Asaas envia metadata.schoolId (evita baixa na escola errada).
        const paymentSchoolId = payment.metadata?.schoolId?.trim();
        if (paymentSchoolId && invoice.schoolId !== paymentSchoolId) {
            return { handled: false, reason: `Invoice schoolId (${invoice.schoolId}) does not match payment metadata schoolId (${paymentSchoolId})` };
        }

        const status = payment.status?.toUpperCase?.() ?? '';

        // Verificação de idempotência: se o status já está no estado desejado, não processar novamente
        const outcome = this.resolveOutcome(eventName, status);
        if (!outcome) {
            return { handled: true, reason: 'No action for event' };
        }

        // Idempotência: verificar se o evento já foi processado
        const currentMetadata = invoice.metadata ?? {};
        const processedEventIds = currentMetadata.processedEventIds 
            ? (typeof currentMetadata.processedEventIds === 'string' 
                ? currentMetadata.processedEventIds.split(',').map(id => id.trim())
                : [])
            : [];
        
        // Se temos o ID do evento e ele já foi processado, retornar imediatamente
        if (input.eventId && processedEventIds.includes(input.eventId)) {
            return { handled: true, reason: 'Event already processed (idempotency by event ID)' };
        }

        // Idempotência adicional: verificar se já processamos este provider_ref com este status
        // Isso previne processamento duplicado mesmo sem eventId
        const lastProcessedProviderRef = currentMetadata.lastProcessedProviderRef;
        const lastProcessedStatus = currentMetadata.lastProcessedStatus;
        if (lastProcessedProviderRef === providerRef && lastProcessedStatus === status && invoice.status === outcome.status) {
            return { handled: true, reason: 'Event already processed (idempotency by provider_ref + status)' };
        }

        // Idempotência: verificar se já está no estado desejado e o último evento foi o mesmo
        if (invoice.status === outcome.status) {
            const lastEvent = currentMetadata.lastWebhookEvent;
            const lastStatus = currentMetadata.lastWebhookStatus;
            
            // Se o evento e status são os mesmos, é um evento duplicado
            if (lastEvent === eventName && lastStatus === status) {
                return { handled: true, reason: 'Event already processed (idempotency by event/status)' };
            }
        }

        const paidAt = outcome.status === 'PAID' ? this.resolvePaidAt(payment) : null;
        const metadata: Record<string, string> = { ...invoice.metadata };
        if (eventName) metadata.lastWebhookEvent = eventName;
        if (status) metadata.lastWebhookStatus = status;
        
        // Armazenar provider_ref e status para idempotência adicional
        metadata.lastProcessedProviderRef = providerRef;
        metadata.lastProcessedStatus = status;
        
        // Armazenar ID do evento processado para idempotência
        if (input.eventId && !processedEventIds.includes(input.eventId)) {
            processedEventIds.push(input.eventId);
            // Manter apenas os últimos 50 eventos para não crescer indefinidamente
            metadata.processedEventIds = processedEventIds.slice(-50).join(',');
        }
        if (outcome.status === 'PAID') {
            await this.ensureSchoolSubAccount(invoice, metadata);
        }

        const updatedInvoice = invoice.withChanges({
            status: outcome.status,
            paidAt,
            metadata,
            updatedAt: new Date()
        });
        await this.invoices.save(updatedInvoice);

        const finance = await this.finances.findById(invoice.financeId);
        if (!finance) {
            return { handled: true, reason: 'Finance not found for invoice' };
        }

        // Idempotência: verificar se o finance já está no estado desejado
        if (finance.status === outcome.planStatus && finance.isPaid === (outcome.status === 'PAID')) {
            // Já está no estado desejado, não precisa atualizar
            return { handled: true, reason: 'Finance already in desired state (idempotency)' };
        }

        const updatedFinance = finance.withChanges({
            status: outcome.planStatus,
            isPaid: outcome.status === 'PAID',
            lastPaymentAt: paidAt ?? finance.lastPaymentAt,
            updatedAt: new Date()
        });
        await this.finances.save(updatedFinance);

        return { handled: true };
    }

    private resolveOutcome(eventName: string, status: string): { status: SchoolPlanInvoiceStatus; planStatus: SchoolPlanStatus } | null {
        if (SUCCESS_EVENTS.has(eventName) || SUCCESS_STATUSES.has(status)) {
            return { status: 'PAID', planStatus: 'ACTIVE' };
        }

        if (CANCELLED_EVENTS.has(eventName) || CANCELLED_STATUSES.has(status)) {
            return { status: 'CANCELLED', planStatus: 'SUSPENDED' };
        }

        if (OVERDUE_EVENTS.has(eventName) || OVERDUE_STATUSES.has(status)) {
            return { status: 'FAILED', planStatus: 'PAST_DUE' };
        }

        if (status === 'PENDING' || eventName === 'PAYMENT_CREATED') {
            return { status: 'ISSUED', planStatus: 'ACTIVE' };
        }

        return null;
    }

    private resolvePaidAt(payment: AsaasPaymentPayload): Date {
        const candidates = [payment.paymentDate, payment.confirmedDate, payment.receivedDate];
        for (const value of candidates) {
            if (!value) continue;
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        return new Date();
    }

    /** Garante que a conta está sendo salva na escola do invoice pago (evita gravar na escola errada). */
    private assertSchoolIsFromInvoice(schoolId: string, invoiceSchoolId: string, context: string): void {
        if (schoolId !== invoiceSchoolId) {
            throw new Error(
                `Account must be saved for the school from the paid invoice. Expected schoolId=${invoiceSchoolId} (invoice), got ${schoolId} (${context}).`
            );
        }
    }

    /**
     * Garante subconta Asaas para a escola do invoice que foi pago e voltou no webhook.
     * A escola é sempre a do invoice (invoice.schoolId) — nunca do payload do webhook — pois o invoice tem schoolId único e é a fonte da verdade para a baixa.
     */
    private async ensureSchoolSubAccount(invoice: SchoolPlanInvoice, metadata: Record<string, string>): Promise<void> {
        if (!this.asaasProvider?.createSubAccount) return;
        const school = await this.schools.findById(invoice.schoolId);
        if (!school) {
            throw new Error(`School ${invoice.schoolId} not found when creating Asaas subaccount`);
        }

        // Validação: verificar se a escola tem os dados obrigatórios
        if (!school.name || !school.name.trim()) {
            throw new Error(`School ${school.id} has invalid name for creating Asaas subaccount`);
        }
        if (!school.email || !school.email.trim()) {
            throw new Error(`School ${school.id} has invalid email for creating Asaas subaccount`);
        }
        if (!school.cnpj || school.cnpj.length !== 14) {
            throw new Error(`School ${school.id} has invalid CNPJ for creating Asaas subaccount`);
        }
        if (!school.phone || school.phone.length < 10) {
            throw new Error(`School ${school.id} has invalid phone for creating Asaas subaccount`);
        }

        const metadataAccountId = metadata.accountId ?? metadata.asaasSubAccountId ?? metadata.paymentAccountId;
        const metadataStatus = metadata.accountStatus ?? metadata.asaasSubAccountStatus ?? metadata.paymentAccountStatus;
        const rawCompanyType = metadata.accountCompanyType ?? metadata.companyType;
        const normalizedCompanyType = typeof rawCompanyType === 'string'
            ? rawCompanyType.trim().toUpperCase()
            : undefined;
        const rawIncomeValue = metadata.accountIncomeValue ?? metadata.incomeValue;
        const parsedIncomeValue = typeof rawIncomeValue === 'string'
            ? Number(rawIncomeValue.trim())
            : typeof rawIncomeValue === 'number'
                ? rawIncomeValue
                : undefined;
        const defaultIncomeValue = school.incomeValue > 0 ? school.incomeValue : 5000;
        const incomeValue = Number.isFinite(parsedIncomeValue) && (parsedIncomeValue as number) > 0
            ? Math.round(parsedIncomeValue as number)
            : defaultIncomeValue;

        // Validação: garantir que incomeValue seja válido
        if (!Number.isFinite(incomeValue) || incomeValue <= 0) {
            throw new Error(`Invalid income value for school ${school.id}: ${incomeValue}`);
        }

        const allowedCompanyTypes = new Set(['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION']);
        const companyType = normalizedCompanyType && allowedCompanyTypes.has(normalizedCompanyType)
            ? normalizedCompanyType
            : 'LIMITED';

        if (school.accountId) {
            // Validação: verificar se accountId não está vazio
            if (!school.accountId.trim()) {
                throw new Error(`School ${school.id} has empty accountId`);
            }
            metadata.accountId = school.accountId;
            if (metadataStatus) {
                metadata.accountStatus = metadataStatus;
            }
            if (!metadata.accountLinkedAt) {
                metadata.accountLinkedAt = new Date().toISOString();
            }
            metadata.accountCompanyType = companyType;
            metadata.accountIncomeValue = String(incomeValue);
            return;
        }

        if (metadataAccountId) {
            // Validação: verificar se metadataAccountId não está vazio
            if (!metadataAccountId.trim()) {
                throw new Error(`Invalid accountId in metadata for school ${school.id}`);
            }
            const updatedFromMetadata = school.withAccountId(metadataAccountId);
            this.assertSchoolIsFromInvoice(updatedFromMetadata.id, invoice.schoolId, 'metadata accountId');
            await this.schools.save(updatedFromMetadata);
            metadata.accountId = metadataAccountId;
            if (metadataStatus) {
                metadata.accountStatus = metadataStatus;
            }
            if (!metadata.accountLinkedAt) {
                metadata.accountLinkedAt = new Date().toISOString();
            }
            metadata.accountCompanyType = companyType;
            metadata.accountIncomeValue = String(incomeValue);
            return;
        }

        // Validação: verificar se a escola tem endereço
        const mainAddress = school.addresses[0];
        if (!mainAddress) {
            throw new Error(`School ${school.id} has no address to create Asaas subaccount`);
        }

        // Validação: verificar se o endereço tem os campos obrigatórios
        if (!mainAddress.street || !mainAddress.street.trim()) {
            throw new Error(`School ${school.id} address has invalid street`);
        }
        if (!mainAddress.number || !mainAddress.number.trim()) {
            throw new Error(`School ${school.id} address has invalid number`);
        }
        if (!mainAddress.zipCode || mainAddress.zipCode.length !== 8) {
            throw new Error(`School ${school.id} address has invalid zip code`);
        }

        let subAccount: { id: string; apiKey?: string; walletId?: string; status?: string };
        try {
            subAccount = await this.asaasProvider.createSubAccount({
                name: school.name,
                email: school.email,
                cpfCnpj: school.cnpj,
                phone: school.phone,
                externalReference: school.id,
                companyType,
                incomeValue,
                address: mainAddress.street,
                addressNumber: mainAddress.number,
                complement: mainAddress.complement ?? null,
                province: mainAddress.district ?? null,
                postalCode: mainAddress.zipCode
            });
        } catch (createError: unknown) {
            const message = createError instanceof Error ? createError.message : String(createError);
            const isEmailAlreadyInUse = /já está em uso|already in use|email.*em uso/i.test(message);
            if (isEmailAlreadyInUse && this.asaasProvider?.listAccountsByEmail) {
                const existing = await this.asaasProvider.listAccountsByEmail(school.email);
                const byExternalRef = existing.find((acc: { externalReference?: string | null }) => acc.externalReference === school.id);
                const found = byExternalRef ?? existing[0];
                if (found?.id) {
                    subAccount = found;
                } else {
                    throw createError;
                }
            } else {
                throw createError;
            }
        }

        // Validação: verificar se a resposta da API contém o ID da conta
        if (!subAccount.id || !subAccount.id.trim()) {
            throw new Error(`Asaas API returned invalid subaccount ID for school ${school.id}`);
        }

        // Atualizar e salvar a conta na escola do invoice que foi pago (nunca em outra escola).
        let updatedSchool = school.withAccountId(subAccount.id);
        if (subAccount.apiKey) {
            updatedSchool = updatedSchool.withAccountApiKey(subAccount.apiKey);
        }
        if (subAccount.walletId) {
            updatedSchool = updatedSchool.withWalletId(subAccount.walletId);
        }
        this.assertSchoolIsFromInvoice(updatedSchool.id, invoice.schoolId, 'subaccount');
        await this.schools.save(updatedSchool);

        metadata.accountId = subAccount.id;
        if (subAccount.status) {
            metadata.accountStatus = subAccount.status;
        }
        metadata.accountLinkedAt = new Date().toISOString();
        metadata.accountCompanyType = companyType;
        metadata.accountIncomeValue = String(incomeValue);
        if (subAccount.apiKey) {
            metadata.accountApiKey = subAccount.apiKey;
        }

        // Buscar onboarding URL em background (não bloqueia resposta do webhook; Asaas recomenda aguardar ~15s antes de consultar documentos)
        if (subAccount.apiKey) {
            this.fetchAndSaveOnboardingUrl(invoice.schoolId, subAccount.apiKey).catch((err) =>
                console.warn('[HandleAsaasPaymentWebhook] Onboarding URL fetch failed:', err)
            );
        }
    }

    /**
     * Busca o link de onboarding (documentos pendentes) no Asaas e persiste na escola.
     * Aguarda 15s antes de consultar, conforme documentação Asaas para subcontas recém-criadas.
     */
    private async fetchAndSaveOnboardingUrl(schoolId: string, accountApiKey: string): Promise<void> {
        try {
            await new Promise((r) => setTimeout(r, 15000));
            const axios = (await import('axios')).default;
            const baseUrl = process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';
            const response = await axios.get(`${baseUrl}/myAccount/documents`, {
                headers: {
                    access_token: accountApiKey,
                    'Content-Type': 'application/json'
                }
            });
            const data = response.data?.data ?? response.data ?? [];
            const list = Array.isArray(data) ? data : [];
            const docWithUrl = list.find((doc: { onboardingUrl?: string }) => doc.onboardingUrl);
            const onboardingUrl = docWithUrl?.onboardingUrl ?? null;
            if (onboardingUrl) {
                const school = await this.schools.findById(schoolId);
                if (school) {
                    const updated = school.withOnboardingUrl(onboardingUrl);
                    await this.schools.save(updated);
                }
            }
        } catch (err) {
            console.warn('[HandleAsaasPaymentWebhook] Failed to fetch onboarding URL for school', schoolId, err);
        }
    }
}
