import type { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import type { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { SchoolFinancialCharge } from '../../domain/entities/school-financial-charge';
import { AppError, ErrorCode } from '../../shared/errors';
import { log } from '../../shared/logger';

export interface SchoolMarkChargePaidInput {
    schoolId: string;
    chargeId: string;
    /** Data do pagamento (data da baixa). */
    data: Date;
    /** Observação opcional da baixa. */
    observacao?: string | null;
}

export interface SchoolMarkChargePaidOutput {
    chargeId: string;
    status: string;
    paidAt: Date;
    observacao: string | null;
}

const ALLOWED_STATUSES_TO_MARK_PAID = new Set(['PENDING_SYNC', 'OPEN', 'OVERDUE', 'FAILED']);

/**
 * Permite à escola dar baixa manual em uma cobrança do aluno (marcar como paga).
 * A cobrança deve pertencer à escola (schoolId).
 * Se a cobrança tiver PIX ou boleto no Asaas (asaasPaymentId), marca como recebida no Asaas
 * (receiveInCash) para o pagamento constar como pago lá também.
 */
export class SchoolMarkChargePaid {
    constructor(
        private readonly chargeRepo: SchoolFinancialChargeRepository,
        private readonly schoolsRepo: SchoolRepository,
        private readonly paymentProvider?: (PaymentProviderPort & Partial<AsaasProviderPort>) | null
    ) {}

    async exec(input: SchoolMarkChargePaidInput): Promise<SchoolMarkChargePaidOutput> {
        const schoolId = input.schoolId?.trim();
        const chargeId = input.chargeId?.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }
        if (!chargeId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'chargeId' });
        }

        const charge = await this.chargeRepo.findById(chargeId);
        if (!charge) {
            throw AppError.notFound('Cobrança', { chargeId });
        }

        if (charge.schoolId !== schoolId) {
            throw AppError.fromCode(ErrorCode.FORBIDDEN, {
                reason: 'Cobrança não pertence a esta escola'
            });
        }

        if (charge.status === 'PAID') {
            return {
                chargeId: charge.id,
                status: 'PAID',
                paidAt: charge.paidAt!,
                observacao: charge.paidObservation
            };
        }

        if (charge.status === 'CANCELLED') {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                reason: 'Não é possível dar baixa em cobrança cancelada'
            });
        }

        if (!ALLOWED_STATUSES_TO_MARK_PAID.has(charge.status)) {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                reason: `Status atual (${charge.status}) não permite dar baixa manual`
            });
        }

        const paidAt = input.data instanceof Date ? input.data : new Date(input.data);
        if (Number.isNaN(paidAt.getTime())) {
            throw AppError.fromCode(ErrorCode.INVALID_DATE, { field: 'data' });
        }

        const observacao = input.observacao != null && typeof input.observacao === 'string'
            ? input.observacao.trim() || null
            : null;

        // Se tem PIX ou boleto no Asaas, marcar como recebido no Asaas (receiveInCash)
        if (charge.asaasPaymentId?.trim() && this.paymentProvider?.receivePaymentInCash) {
            await this.tryMarkAsaasPaymentReceived(charge, paidAt);
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
            providerNetAmountCents: charge.providerNetAmountCents ?? null,
            dueDate: charge.dueDate,
            status: 'PAID',
            asaasPaymentId: charge.asaasPaymentId,
            asaasInvoiceUrl: charge.asaasInvoiceUrl,
            asaasPayload: charge.asaasPayload,
            paidAt,
            paymentMethod: 'MANUAL',
            paidObservation: observacao,
            cancelledAt: charge.cancelledAt,
            createdAt: charge.createdAt,
            updatedAt: new Date()
        });
        await this.chargeRepo.save(updated);

        return {
            chargeId: updated.id,
            status: updated.status,
            paidAt: updated.paidAt!,
            observacao: updated.paidObservation
        };
    }

    /**
     * Marca a cobrança como recebida no Asaas (receiveInCash), para o PIX/boleto constar como pago lá.
     * Em caso de falha, apenas registra log e segue com a baixa no nosso lado.
     */
    private async tryMarkAsaasPaymentReceived(charge: SchoolFinancialCharge, paidAt: Date): Promise<void> {
        try {
            const provider = await this.resolvePaymentProvider(charge);
            if (!provider?.receivePaymentInCash) return;
            const paymentDate = paidAt.toISOString().slice(0, 10);
            const valueReais = charge.netAmountCents / 100;
            await provider.receivePaymentInCash(charge.asaasPaymentId!, {
                paymentDate,
                value: valueReais,
                notifyCustomer: false
            });
            log.info('[SchoolMarkChargePaid] Cobrança Asaas marcada como recebida ao dar baixa manual', {
                chargeId: charge.id,
                asaasPaymentId: charge.asaasPaymentId
            });
        } catch (err) {
            log.warn('[SchoolMarkChargePaid] Falha ao marcar cobrança como recebida no Asaas (baixa manual segue no nosso lado)', {
                chargeId: charge.id,
                asaasPaymentId: charge.asaasPaymentId,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    private async resolvePaymentProvider(charge: SchoolFinancialCharge): Promise<(PaymentProviderPort & Partial<AsaasProviderPort>) | null> {
        if (!this.paymentProvider) return null;
        const school = await this.schoolsRepo.findById(charge.schoolId);
        if (!school?.accountId?.trim() || !school.accountApiKey?.trim()) {
            return this.paymentProvider;
        }
        const { AsaasProviderFactory } = await import('../../infra/providers/asaas/asaas-provider-factory.js');
        const sub = AsaasProviderFactory.createSubAccountProvider(school.accountApiKey);
        return sub ?? this.paymentProvider;
    }
}
