import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceStatus } from '../../domain/entities/school-plan-invoice';
import { SchoolPlanStatus } from '../../domain/entities/school-plan-finance';

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
        private readonly finances: SchoolPlanFinanceRepository
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
}
