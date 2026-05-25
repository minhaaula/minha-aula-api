import type { SchoolFinancialChargeRepository } from '../../../ports/repositories/school-financial-charge.repo';
import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { PaymentProviderPort } from '../../../ports/providers/payment-provider.port';
import type { AsaasProviderPort } from '../../../ports/providers/asaas-port';
import { SchoolFinancialCharge } from '../../../domain/entities/school-financial-charge';
import { AppError, ErrorCode } from '../../../shared/errors';
import { log } from '../../../shared/logger';
import { assertChargeDeletable } from '../../utils/assert-charge-deletable';

export interface SchoolDeleteChargeInput {
    schoolId: string;
    chargeId: string;
}

export interface SchoolDeleteChargeOutput {
    chargeId: string;
    status: 'CANCELLED';
    cancelledAt: Date;
    alreadyCancelled: boolean;
}

/**
 * Permite à escola excluir (cancelar) uma cobrança em aberto do aluno.
 * A cobrança deve pertencer à escola (`schoolId`).
 * Se houver cobrança no Asaas, tenta removê-la antes do cancelamento local.
 */
export class SchoolDeleteCharge {
    constructor(
        private readonly chargeRepo: SchoolFinancialChargeRepository,
        private readonly schoolsRepo: SchoolRepository,
        private readonly paymentProvider?: (PaymentProviderPort & Partial<AsaasProviderPort>) | null
    ) {}

    async exec(input: SchoolDeleteChargeInput): Promise<SchoolDeleteChargeOutput> {
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

        if (charge.status === 'CANCELLED') {
            return {
                chargeId: charge.id,
                status: 'CANCELLED',
                cancelledAt: charge.cancelledAt ?? charge.updatedAt,
                alreadyCancelled: true
            };
        }

        assertChargeDeletable(charge);

        if (charge.asaasPaymentId?.trim() && this.paymentProvider?.deletePayment) {
            await this.tryDeleteAsaasPayment(charge);
        }

        const cancelledAt = new Date();
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
            status: 'CANCELLED',
            asaasPaymentId: charge.asaasPaymentId,
            asaasInvoiceUrl: charge.asaasInvoiceUrl,
            asaasPayload: charge.asaasPayload,
            paidAt: null,
            paymentMethod: charge.paymentMethod,
            paidObservation: charge.paidObservation,
            cancelledAt,
            createdAt: charge.createdAt,
            updatedAt: new Date()
        });
        await this.chargeRepo.save(updated);

        return {
            chargeId: updated.id,
            status: 'CANCELLED',
            cancelledAt,
            alreadyCancelled: false
        };
    }

    private async tryDeleteAsaasPayment(charge: SchoolFinancialCharge): Promise<void> {
        try {
            const provider = await this.resolvePaymentProvider(charge);
            if (!provider?.deletePayment) return;
            await provider.deletePayment(charge.asaasPaymentId!);
            log.info('[SchoolDeleteCharge] Cobrança removida no Asaas', {
                chargeId: charge.id,
                asaasPaymentId: charge.asaasPaymentId
            });
        } catch (err) {
            log.warn('[SchoolDeleteCharge] Falha ao excluir cobrança no Asaas (cancelamento local segue)', {
                chargeId: charge.id,
                asaasPaymentId: charge.asaasPaymentId,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    private async resolvePaymentProvider(
        charge: SchoolFinancialCharge
    ): Promise<(PaymentProviderPort & Partial<AsaasProviderPort>) | null> {
        if (!this.paymentProvider) return null;
        const school = await this.schoolsRepo.findById(charge.schoolId);
        if (!school?.accountId?.trim() || !school.accountApiKey?.trim()) {
            return this.paymentProvider;
        }
        const { AsaasProviderFactory } = await import('../../../infra/providers/asaas/asaas-provider-factory.js');
        const sub = AsaasProviderFactory.createSubAccountProvider(school.accountApiKey);
        return sub ?? this.paymentProvider;
    }
}
