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
};

type HandleAsaasPaymentWebhookInput = {
    event: string;
    payment?: AsaasPaymentPayload | null;
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

        const providerRef = payment.id.trim();
        let invoice = await this.invoices.findByProviderRef(providerRef);
        if (!invoice && payment.externalReference) {
            invoice = await this.invoices.findByExternalReference(payment.externalReference);
        }

        if (!invoice) {
            return { handled: false, reason: 'Invoice not found' };
        }

        const status = payment.status?.toUpperCase?.() ?? '';

        const outcome = this.resolveOutcome(eventName, status);
        if (!outcome) {
            return { handled: true, reason: 'No action for event' };
        }

        const paidAt = outcome.status === 'PAID' ? this.resolvePaidAt(payment) : null;
        const metadata: Record<string, string> = { ...invoice.metadata };
        if (eventName) metadata.lastWebhookEvent = eventName;
        if (status) metadata.lastWebhookStatus = status;
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

        const subAccount = await this.asaasProvider.createSubAccount({
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

        // Validação: verificar se a resposta da API contém o ID da conta
        if (!subAccount.id || !subAccount.id.trim()) {
            throw new Error(`Asaas API returned invalid subaccount ID for school ${school.id}`);
        }

        // Atualizar escola com accountId e accountApiKey
        let updatedSchool = school.withAccountId(subAccount.id);
        if (subAccount.apiKey) {
            updatedSchool = updatedSchool.withAccountApiKey(subAccount.apiKey);
        }
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
    }
}
