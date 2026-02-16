import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceStatus } from '../../domain/entities/school-plan-invoice';
import { SchoolPlanStatus } from '../../domain/entities/school-plan-finance';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { OutboxRepository } from '../../ports/repositories/outbox.repo';

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
        private readonly asaasProvider?: AsaasProviderPort,
        private readonly outbox?: OutboxRepository
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
        if (outcome.status === 'PAID' && this.outbox) {
            await this.outbox.enqueue({
                type: 'ensure_school_asaas_account',
                payload: { invoiceId: invoice.id },
                aggregateId: invoice.schoolId
            });
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
}
