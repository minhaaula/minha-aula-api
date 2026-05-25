import type { SchoolFinancialChargeRepository } from '../../../ports/repositories/school-financial-charge.repo';
import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { AsaasProviderPort } from '../../../ports/providers/asaas-port';
import { SchoolFinancialCharge } from '../../../domain/entities/school-financial-charge';
import { AppError, ErrorCode } from '../../../shared/errors';
import { log } from '../../../shared/logger';
import { assertChargeDeletable } from '../../utils/assert-charge-deletable';

export interface AdminDeleteChargeInput {
    chargeId: string;
}

export interface AdminDeleteChargeOutput {
    chargeId: string;
    status: 'CANCELLED';
    cancelledAt: Date;
    alreadyCancelled: boolean;
}

export class AdminDeleteCharge {
    constructor(
        private readonly chargeRepo: SchoolFinancialChargeRepository,
        private readonly schoolsRepo: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort | null
    ) {}

    async exec(input: AdminDeleteChargeInput): Promise<AdminDeleteChargeOutput> {
        const chargeId = input.chargeId?.trim();
        if (!chargeId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'chargeId' });
        }

        const charge = await this.chargeRepo.findById(chargeId);
        if (!charge) {
            throw AppError.notFound('Cobrança', { chargeId });
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

        if (charge.asaasPaymentId?.trim() && this.asaasProvider?.deletePayment) {
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
            const provider = await this.resolveAsaasProvider(charge);
            if (!provider?.deletePayment) return;
            await provider.deletePayment(charge.asaasPaymentId!);
            log.info('[AdminDeleteCharge] Cobrança removida no Asaas', {
                chargeId: charge.id,
                asaasPaymentId: charge.asaasPaymentId
            });
        } catch (err) {
            log.warn('[AdminDeleteCharge] Falha ao excluir cobrança no Asaas (cancelamento local segue)', {
                chargeId: charge.id,
                asaasPaymentId: charge.asaasPaymentId,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    private async resolveAsaasProvider(charge: SchoolFinancialCharge): Promise<AsaasProviderPort | null> {
        if (!this.asaasProvider) return null;
        const school = await this.schoolsRepo.findById(charge.schoolId);
        if (!school?.accountApiKey?.trim()) {
            return this.asaasProvider;
        }
        const { AsaasProviderFactory } = await import('../../../infra/providers/asaas/asaas-provider-factory.js');
        const sub = AsaasProviderFactory.createSubAccountProvider(school.accountApiKey);
        return (sub as AsaasProviderPort) ?? this.asaasProvider;
    }
}
