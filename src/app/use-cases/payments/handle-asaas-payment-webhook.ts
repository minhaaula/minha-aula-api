import { SchoolPlanInvoiceRepository } from '../../../ports/repositories/school-plan-invoice.repo';
import { SchoolPlanFinanceRepository } from '../../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceStatus } from '../../../domain/entities/school-plan-invoice';
import { SchoolPlanStatus } from '../../../domain/entities/school-plan-finance';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { AsaasProviderPort } from '../../../ports/providers/asaas-port';
import { OutboxRepository } from '../../../ports/repositories/outbox.repo';
import { SchoolFinancialChargeRepository } from '../../../ports/repositories/school-financial-charge.repo';
import {
    SchoolFinancialCharge,
    SchoolFinancialChargePaymentMethod,
    SchoolFinancialChargeStatus
} from '../../../domain/entities/school-financial-charge';
import { log } from '../../../shared/logger';
import { parseAsaasReaisToCents } from '../../../shared/asaas-money';

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
    /** Valor líquido (já com taxa Asaas). */
    netValue?: number | null;
    billingType?: string | null;
    /** Metadata enviada na criação da cobrança (schoolId, planId, financeId) — usada para validar que o invoice é da escola correta. */
    metadata?: Record<string, string> | null;
};

type HandleAsaasPaymentWebhookInput = {
    event: string;
    payment?: AsaasPaymentPayload | null;
    eventId?: string | null; // ID do evento do Asaas para idempotência
    /** `dateCreated` do payload raiz do webhook — costuma incluir hora; `paymentDate` no Asaas é só data. */
    eventCreatedAt?: string | null;
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
    private static readonly CHARGE_CAN_MARK_PAID: ReadonlySet<SchoolFinancialChargeStatus> = new Set([
        'PENDING_SYNC',
        'OPEN',
        'OVERDUE',
        'FAILED'
    ]);

    constructor(
        private readonly invoices: SchoolPlanInvoiceRepository,
        private readonly finances: SchoolPlanFinanceRepository,
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort,
        private readonly outbox?: OutboxRepository,
        private readonly financialCharges?: SchoolFinancialChargeRepository
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

        if (invoice) {
            // Garantir que o invoice é da escola do pagamento quando o Asaas envia metadata.schoolId (evita baixa na escola errada).
            const paymentSchoolId = payment.metadata?.schoolId?.trim();
            if (paymentSchoolId && invoice.schoolId !== paymentSchoolId) {
                return {
                    handled: false,
                    reason: `Invoice schoolId (${invoice.schoolId}) does not match payment metadata schoolId (${paymentSchoolId})`
                };
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
                ? typeof currentMetadata.processedEventIds === 'string'
                    ? currentMetadata.processedEventIds.split(',').map((id) => id.trim())
                    : []
                : [];

            // Se temos o ID do evento e ele já foi processado, retornar imediatamente
            if (input.eventId && processedEventIds.includes(input.eventId)) {
                return { handled: true, reason: 'Event already processed (idempotency by event ID)' };
            }

            // Idempotência adicional: verificar se já processamos este provider_ref com este status
            // Isso previne processamento duplicado mesmo sem eventId
            const lastProcessedProviderRef = currentMetadata.lastProcessedProviderRef;
            const lastProcessedStatus = currentMetadata.lastProcessedStatus;
            if (
                lastProcessedProviderRef === providerRef &&
                lastProcessedStatus === status &&
                invoice.status === outcome.status
            ) {
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

            const paidAt = outcome.status === 'PAID' ? this.resolvePaidAt(payment, input.eventCreatedAt) : null;
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

            // Enfileirar job APÓS persistir invoice como PAID — evita race onde o worker
            // processa o job antes do save e encontra invoice ainda ISSUED.
            if (outcome.status === 'PAID' && this.outbox) {
                log.info('[Webhook Asaas] Enfileirando job ensure_school_asaas_account (conta Asaas + onboarding)', {
                    invoiceId: invoice.id,
                    schoolId: invoice.schoolId,
                    providerRef
                });
                await this.outbox.enqueue({
                    type: 'ensure_school_asaas_account',
                    payload: { invoiceId: invoice.id },
                    aggregateId: invoice.schoolId
                });
            }

            return { handled: true };
        }

        if (this.financialCharges) {
            return await this.handleSchoolFinancialCharge(input, payment, providerRef, eventName);
        }

        return { handled: false, reason: 'Invoice or charge not found' };
    }

    /**
     * Cobranças de curso (mensalidade/matrícula) na subconta da escola usam `school_financial_charges`;
     * localiza por `asaas_payment_id` ou por `externalReference` (= id da cobrança, sem `:`).
     */
    private async handleSchoolFinancialCharge(
        input: HandleAsaasPaymentWebhookInput,
        payment: AsaasPaymentPayload,
        providerRef: string,
        eventName: string
    ): Promise<HandleAsaasPaymentWebhookOutput> {
        const charges = this.financialCharges!;
        let charge = await charges.findByAsaasPaymentId(providerRef);
        if (!charge && payment.externalReference?.trim()) {
            const ext = payment.externalReference.trim();
            if (!ext.includes(':')) {
                charge = (await charges.findById(ext)) ?? null;
            }
        }

        if (!charge) {
            return { handled: false, reason: 'Invoice or charge not found' };
        }

        const paymentSchoolId = payment.metadata?.schoolId?.trim();
        if (paymentSchoolId && charge.schoolId !== paymentSchoolId) {
            return {
                handled: false,
                reason: `Charge schoolId (${charge.schoolId}) does not match payment metadata schoolId (${paymentSchoolId})`
            };
        }

        const status = payment.status?.toUpperCase?.() ?? '';
        const targetStatus = this.resolveFinancialChargeTargetStatus(eventName, status);
        if (!targetStatus) {
            return { handled: true, reason: 'No action for event' };
        }

        if (charge.status === 'PAID' && targetStatus === 'PAID') {
            const backfilled = await this.tryBackfillProviderNetAmountCents(charge, payment);
            if (backfilled) {
                log.info('[Webhook Asaas] providerNetAmountCents preenchido em cobrança já paga', {
                    chargeId: charge.id,
                    providerRef
                });
            }
            return { handled: true, reason: 'Charge already paid (idempotency)' };
        }
        if (charge.status === 'PAID' && targetStatus !== 'PAID') {
            return { handled: true, reason: 'Charge already paid; ignoring event' };
        }

        if (targetStatus === 'PAID' && !HandleAsaasPaymentWebhook.CHARGE_CAN_MARK_PAID.has(charge.status)) {
            return {
                handled: true,
                reason: `Charge in status ${charge.status} cannot be marked paid by webhook`
            };
        }

        if (targetStatus === 'CANCELLED' && charge.status === 'PAID') {
            return { handled: true, reason: 'Charge already paid; ignoring cancel event' };
        }

        if (
            targetStatus === 'OVERDUE' &&
            (charge.status === 'PAID' || charge.status === 'CANCELLED')
        ) {
            return { handled: true, reason: 'Incompatible overdue event for current charge status' };
        }

        const paidAt =
            targetStatus === 'PAID' ? this.resolvePaidAt(payment, input.eventCreatedAt) : charge.paidAt;
        const paymentMethodForPaid =
            targetStatus === 'PAID'
                ? this.mapBillingTypeToPaymentMethod(payment.billingType) ?? charge.paymentMethod
                : charge.paymentMethod;
        const providerNetAmountCents =
            targetStatus === 'PAID'
                ? await this.resolveProviderNetAmountCents(charge, payment)
                : charge.providerNetAmountCents;

        const updated = SchoolFinancialCharge.restore({
            id: charge.id,
            schoolId: charge.schoolId,
            ownerUserId: charge.ownerUserId,
            studentUserId: charge.studentUserId,
            dependentId: charge.dependentId,
            courseId: charge.courseId,
            courseClassId: charge.courseClassId,
            chargeType: charge.chargeType,
            description: charge.description,
            amountCents: charge.amountCents,
            discountCents: charge.discountCents,
            discountReason: charge.discountReason,
            netAmountCents: charge.netAmountCents,
            providerNetAmountCents,
            dueDate: charge.dueDate,
            status: targetStatus,
            asaasPaymentId: charge.asaasPaymentId,
            asaasInvoiceUrl: charge.asaasInvoiceUrl,
            asaasPayload: charge.asaasPayload,
            paidAt:
                targetStatus === 'PAID'
                    ? paidAt ?? new Date()
                    : targetStatus === 'CANCELLED'
                      ? null
                      : charge.paidAt,
            paymentMethod: paymentMethodForPaid,
            paidObservation: charge.paidObservation,
            cancelledAt: targetStatus === 'CANCELLED' ? (charge.cancelledAt ?? new Date()) : charge.cancelledAt,
            createdAt: charge.createdAt,
            updatedAt: new Date()
        });

        await charges.save(updated);

        log.info('[Webhook Asaas] Cobrança financeira da escola atualizada', {
            chargeId: charge.id,
            schoolId: charge.schoolId,
            providerRef,
            targetStatus
        });

        return { handled: true };
    }

    /** Líquido Asaas: webhook → API GET /payments/:id → valor já persistido. */
    private async resolveProviderNetAmountCents(
        charge: SchoolFinancialCharge,
        payment: AsaasPaymentPayload
    ): Promise<number | null> {
        const fromWebhook = parseAsaasReaisToCents(payment.netValue);
        if (fromWebhook != null) {
            return fromWebhook;
        }

        const paymentId = charge.asaasPaymentId?.trim() || payment.id?.trim();
        if (paymentId && this.asaasProvider?.getPayment) {
            try {
                const remote = await this.asaasProvider.getPayment(paymentId);
                const fromApi = parseAsaasReaisToCents(remote.netValue);
                if (fromApi != null) {
                    return fromApi;
                }
            } catch (error) {
                log.warn('[Webhook Asaas] Falha ao buscar netValue no Asaas', {
                    chargeId: charge.id,
                    paymentId,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return charge.providerNetAmountCents ?? null;
    }

    /**
     * PAYMENT_CONFIRMED pode chegar antes de PAYMENT_RECEIVED (com `netValue`).
     * Se a cobrança já está PAID sem líquido, tenta preencher no evento seguinte.
     */
    private async tryBackfillProviderNetAmountCents(
        charge: SchoolFinancialCharge,
        payment: AsaasPaymentPayload
    ): Promise<boolean> {
        if (charge.providerNetAmountCents != null && charge.providerNetAmountCents > 0) {
            return false;
        }

        const cents = await this.resolveProviderNetAmountCents(charge, payment);
        if (cents == null) {
            return false;
        }

        const updated = SchoolFinancialCharge.restore({
            id: charge.id,
            schoolId: charge.schoolId,
            ownerUserId: charge.ownerUserId,
            studentUserId: charge.studentUserId,
            dependentId: charge.dependentId,
            courseId: charge.courseId,
            courseClassId: charge.courseClassId,
            chargeType: charge.chargeType,
            description: charge.description,
            amountCents: charge.amountCents,
            discountCents: charge.discountCents,
            discountReason: charge.discountReason,
            netAmountCents: charge.netAmountCents,
            providerNetAmountCents: cents,
            dueDate: charge.dueDate,
            status: charge.status,
            asaasPaymentId: charge.asaasPaymentId,
            asaasInvoiceUrl: charge.asaasInvoiceUrl,
            asaasPayload: charge.asaasPayload,
            paidAt: charge.paidAt,
            paymentMethod: charge.paymentMethod,
            paidObservation: charge.paidObservation,
            cancelledAt: charge.cancelledAt,
            createdAt: charge.createdAt,
            updatedAt: new Date()
        });

        await this.financialCharges!.save(updated);
        return true;
    }

    private resolveFinancialChargeTargetStatus(
        eventName: string,
        paymentStatus: string
    ): SchoolFinancialChargeStatus | null {
        const u = eventName.toUpperCase();
        const s = paymentStatus.toUpperCase();
        if (SUCCESS_EVENTS.has(u) || SUCCESS_STATUSES.has(s)) return 'PAID';
        if (CANCELLED_EVENTS.has(u) || CANCELLED_STATUSES.has(s)) return 'CANCELLED';
        if (OVERDUE_EVENTS.has(u) || OVERDUE_STATUSES.has(s)) return 'OVERDUE';
        if (s === 'PENDING' || u === 'PAYMENT_CREATED') return null;
        return null;
    }

    private mapBillingTypeToPaymentMethod(
        billingType: string | null | undefined
    ): SchoolFinancialChargePaymentMethod | null {
        const u = billingType?.toUpperCase()?.trim();
        if (u === 'PIX') return 'PIX';
        if (u === 'BOLETO') return 'BOLETO';
        return null;
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

    /**
     * O Asaas documenta `paymentDate` / `confirmedDate` como data (sem hora). O horário do evento vem em
     * `dateCreated` no nível raiz do webhook (`2024-06-12 16:45:03`). Quando só há data na cobrança,
     * usamos `eventCreatedAt` para `paidAt`.
     */
    private resolvePaidAt(payment: AsaasPaymentPayload, eventCreatedAt?: string | null): Date {
        const candidates = [payment.paymentDate, payment.confirmedDate, payment.receivedDate];

        for (const value of candidates) {
            if (!value) continue;
            if (hasTimeComponent(value)) {
                const parsed = new Date(value);
                if (!Number.isNaN(parsed.getTime())) {
                    return parsed;
                }
            }
        }

        const fromEvent = eventCreatedAt?.trim() ? parseAsaasWebhookEventDateTime(eventCreatedAt.trim()) : null;
        if (fromEvent) {
            return fromEvent;
        }

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

/** Data pura (YYYY-MM-DD ou DD/MM/AAAA) — sem componente de hora no payload do Asaas. */
function hasTimeComponent(value: string): boolean {
    const v = value.trim();
    if (!v) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return false;
    return /[T ]\d{1,2}:\d{2}/.test(v);
}

/**
 * `dateCreated` do webhook Asaas: `"2024-06-12 16:45:03"` (documentação oficial).
 * Interpretamos como horário de Brasília quando não há offset explícito.
 */
function parseAsaasWebhookEventDateTime(trimmed: string): Date | null {
    const spaceOrT = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/i
    );
    if (spaceOrT) {
        const [, y, mo, d, h, mi, s, frac, offset] = spaceOrT;
        if (offset) {
            const iso = frac
                ? `${y}-${mo}-${d}T${h}:${mi}:${s}${frac}${offset}`
                : `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
            const parsed = new Date(iso);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
        const base = `${y}-${mo}-${d}T${h}:${mi}:${s}${frac ?? ''}-03:00`;
        const parsed = new Date(base);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
