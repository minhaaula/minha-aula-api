import type { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { SchoolFinancialCharge } from '../../domain/entities/school-financial-charge';
import { AppError, ErrorCode } from '../../shared/errors';

export interface AdminMarkChargePaidInput {
    chargeId: string;
    /** Data do pagamento; se não informada, usa a data/hora atual. */
    paidAt?: Date;
}

export interface AdminMarkChargePaidOutput {
    chargeId: string;
    status: string;
    paidAt: Date;
}

const ALLOWED_STATUSES_TO_MARK_PAID = new Set(['PENDING_SYNC', 'OPEN', 'OVERDUE', 'FAILED']);

export class AdminMarkChargePaid {
    constructor(private readonly chargeRepo: SchoolFinancialChargeRepository) {}

    async exec(input: AdminMarkChargePaidInput): Promise<AdminMarkChargePaidOutput> {
        const chargeId = input.chargeId?.trim();
        if (!chargeId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'chargeId' });
        }

        const charge = await this.chargeRepo.findById(chargeId);
        if (!charge) {
            throw AppError.notFound('Cobrança', { chargeId });
        }

        if (charge.status === 'PAID') {
            return {
                chargeId: charge.id,
                status: 'PAID',
                paidAt: charge.paidAt!
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

        const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
        if (Number.isNaN(paidAt.getTime())) {
            throw AppError.fromCode(ErrorCode.INVALID_DATE, { field: 'paidAt' });
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
            dueDate: charge.dueDate,
            status: 'PAID',
            asaasPaymentId: charge.asaasPaymentId,
            asaasInvoiceUrl: charge.asaasInvoiceUrl,
            asaasPayload: charge.asaasPayload,
            paidAt,
            cancelledAt: charge.cancelledAt,
            createdAt: charge.createdAt,
            updatedAt: new Date()
        });
        await this.chargeRepo.save(updated);

        return {
            chargeId: updated.id,
            status: updated.status,
            paidAt: updated.paidAt!
        };
    }
}
