import { SchoolWithdrawalRepository } from '../../ports/repositories/school-withdrawal.repo';
import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { OutboxRepository } from '../../ports/repositories/outbox.repo';
import { log } from '../../shared/logger';
import { sanitizeForLogging } from '../../shared/log-sanitizer';

type AsaasTransferPayload = {
    id?: string | null;
    status?: string | null;
    effectiveDate?: string | null;
    scheduleDate?: string | null;
    failReason?: string | null;
    externalReference?: string | null;
    transactionReceiptUrl?: string | null;
};

export type HandleAsaasTransferWebhookInput = {
    event: string;
    transfer?: AsaasTransferPayload | null;
    eventId?: string | null;
    eventCreatedAt?: string | null;
};

export type HandleAsaasTransferWebhookOutput = {
    handled: boolean;
    reason?: string;
};

const COMPLETED_EVENTS: ReadonlySet<string> = new Set(['TRANSFER_DONE']);
const COMPLETED_STATUSES: ReadonlySet<string> = new Set(['DONE', 'COMPLETED']);

const FAILED_EVENTS: ReadonlySet<string> = new Set([
    'TRANSFER_FAILED',
    'TRANSFER_CANCELLED',
    'TRANSFER_BLOCKED'
]);
const FAILED_STATUSES: ReadonlySet<string> = new Set(['FAILED', 'CANCELLED', 'BLOCKED']);

const PENDING_EVENTS: ReadonlySet<string> = new Set([
    'TRANSFER_CREATED',
    'TRANSFER_PENDING',
    'TRANSFER_IN_BANK_PROCESSING'
]);

/**
 * Processa eventos `TRANSFER_*` (saque/transferência) recebidos via webhook do Asaas.
 *
 * O fluxo de saque (`request-school-withdrawal`) cria a transferência via API e persiste o
 * `providerRef` retornado. Como o Asaas pode retornar `PENDING` / `IN_BANK_PROCESSING` na
 * resposta síncrona, o status final só é conhecido via webhook.
 */
export class HandleAsaasTransferWebhook {
    constructor(
        private readonly withdrawals: SchoolWithdrawalRepository,
        private readonly schools?: SchoolRepository,
        private readonly outbox?: OutboxRepository
    ) {}

    async exec(input: HandleAsaasTransferWebhookInput): Promise<HandleAsaasTransferWebhookOutput> {
        const eventName = input.event?.toUpperCase?.() ?? '';
        const transfer = input.transfer;

        if (!transfer || typeof transfer.id !== 'string' || !transfer.id.trim()) {
            return { handled: false, reason: 'Missing transfer payload' };
        }

        const providerRef = transfer.id.trim();

        if (!this.withdrawals.findByProviderRef) {
            log.warn('[Asaas Transfer] Repositório sem findByProviderRef; saque não pôde ser localizado', {
                event: eventName,
                providerRef
            });
            return { handled: false, reason: 'Repository does not support providerRef lookup' };
        }

        const withdrawal = await this.withdrawals.findByProviderRef(providerRef);
        if (!withdrawal) {
            log.warn('[Asaas Transfer] Saque não encontrado para o providerRef informado', {
                event: eventName,
                providerRef,
                externalReference: transfer.externalReference ?? null
            });
            return { handled: false, reason: 'Withdrawal not found for transfer providerRef' };
        }

        const status = transfer.status?.toUpperCase?.() ?? '';

        if (COMPLETED_EVENTS.has(eventName) || COMPLETED_STATUSES.has(status)) {
            if (withdrawal.status === 'COMPLETED') {
                return { handled: true, reason: 'Withdrawal already completed (idempotent)' };
            }
            const effectiveDate = transfer.effectiveDate ? this.parseDate(transfer.effectiveDate) : null;
            withdrawal.markAsCompleted(effectiveDate ?? undefined);
            await this.withdrawals.save(withdrawal);
            log.info('[Asaas Transfer] Saque concluído', { providerRef, withdrawalId: withdrawal.id });
            await this.tryEnqueueCompletedWithdrawalWhatsApp(withdrawal.id, withdrawal.schoolId);
            return { handled: true, reason: 'Withdrawal completed' };
        }

        if (FAILED_EVENTS.has(eventName) || FAILED_STATUSES.has(status)) {
            if (withdrawal.status === 'CANCELLED') {
                return { handled: true, reason: 'Withdrawal already cancelled (idempotent)' };
            }
            const reason = transfer.failReason?.trim() || `Transferência ${status || eventName}`;
            withdrawal.markAsCancelled(reason);
            await this.withdrawals.save(withdrawal);
            log.info('[Asaas Transfer] Saque cancelado/recusado', {
                providerRef,
                withdrawalId: withdrawal.id,
                reason: reason.slice(0, 200)
            });
            return { handled: true, reason: 'Withdrawal cancelled' };
        }

        if (PENDING_EVENTS.has(eventName)) {
            // Mantém o saque em PROCESSING; apenas registra a transição informativa.
            log.info('[Asaas Transfer] Saque em processamento', {
                providerRef,
                withdrawalId: withdrawal.id,
                event: eventName,
                status
            });
            return { handled: true, reason: 'Withdrawal still processing' };
        }

        return { handled: true, reason: 'Event not actionable' };
    }

    private async tryEnqueueCompletedWithdrawalWhatsApp(withdrawalId: string, schoolId: string): Promise<void> {
        if (!this.schools || !this.outbox) return;
        try {
            const school = await this.schools.findById(schoolId);
            if (!school) return;
            if (!school.notificationsWhatsappEnabled) return;

            const to = school.ownerWhatsapp?.trim();
            if (!to) return;

            const nome = (school.ownerName ?? school.name).trim();
            const escola = school.name.trim();

            await this.outbox.enqueue({
                type: 'whatsapp_notification',
                aggregateId: withdrawalId,
                payload: {
                    to,
                    saqueRealizadoEscola: { nome, escola }
                }
            });

            log.info('[Asaas Transfer] WhatsApp de saque concluído enfileirado', sanitizeForLogging({
                aggregateId: withdrawalId,
                schoolId,
                to,
            }) as object);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('[Asaas Transfer] Falha ao enfileirar WhatsApp de saque concluído', sanitizeForLogging({
                aggregateId: withdrawalId,
                schoolId,
                error: msg
            }) as object);
        }
    }

    private parseDate(value: string): Date | null {
        const trimmed = value?.trim();
        if (!trimmed) return null;
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
}
