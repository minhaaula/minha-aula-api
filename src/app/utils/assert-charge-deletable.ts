import type { SchoolFinancialCharge } from '../../domain/entities/school-financial-charge';
import { AppError, ErrorCode } from '../../shared/errors';

const DELETABLE_STATUSES = new Set(['PENDING_SYNC', 'OPEN', 'OVERDUE', 'FAILED']);

/** Impede exclusão de cobranças pagas ou com status não cancelável. */
export function assertChargeDeletable(charge: SchoolFinancialCharge): void {
    if (charge.isPaidSettled()) {
        throw AppError.fromCode(ErrorCode.CHARGE_ALREADY_PAID, {
            chargeId: charge.id,
            status: charge.status,
            paidAt: charge.paidAt?.toISOString() ?? null
        });
    }

    if (!DELETABLE_STATUSES.has(charge.status)) {
        throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
            message: `Status atual (${charge.status}) não permite exclusão`,
            chargeId: charge.id,
            status: charge.status
        });
    }
}
