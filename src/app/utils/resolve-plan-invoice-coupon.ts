import { DiscountCoupon } from '../../domain/entities/discount-coupon';
import { DiscountCouponRepository } from '../../ports/repositories/discount-coupon.repo';
import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';

type ResolvePlanInvoiceCouponParams = {
    financeId: string;
    dueDate: Date;
    explicitCouponCode?: string | null;
    coupons: DiscountCouponRepository;
    invoices: SchoolPlanInvoiceRepository;
};

/**
 * Resolve o cupom a aplicar na fatura do plano.
 * Gera uma fatura por ciclo; o desconto é reaplicado enquanto houver meses restantes
 * no cupom (durationMonths) e a data de vencimento estiver dentro de validUntil.
 */
export async function resolvePlanInvoiceCoupon(
    params: ResolvePlanInvoiceCouponParams
): Promise<DiscountCoupon | null> {
    const { financeId, dueDate, explicitCouponCode, coupons, invoices } = params;

    const toUtcDateOnly = (d: Date) =>
        new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const due = toUtcDateOnly(dueDate);

    if (explicitCouponCode?.trim()) {
        const code = explicitCouponCode.trim().toUpperCase();
        const coupon = await coupons.findByCode(code);
        if (!coupon || !(await canApplyCoupon(coupon, financeId, due, invoices))) {
            return null;
        }
        return coupon;
    }

    const activeCouponId = await findActiveCouponIdForFinance(financeId, invoices);
    if (!activeCouponId) {
        return null;
    }

    const coupon = await coupons.findById(activeCouponId);
    if (!coupon || !(await canApplyCoupon(coupon, financeId, due, invoices))) {
        return null;
    }

    return coupon;
}

async function findActiveCouponIdForFinance(
    financeId: string,
    invoices: SchoolPlanInvoiceRepository
): Promise<string | null> {
    const items = await invoices.findByFinanceId(financeId);
    const withCoupon = items
        .filter((inv) => inv.discountCouponId)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return withCoupon[0]?.discountCouponId ?? null;
}

async function canApplyCoupon(
    coupon: DiscountCoupon,
    financeId: string,
    dueDate: Date,
    invoices: SchoolPlanInvoiceRepository
): Promise<boolean> {
    if (!coupon.isValid()) {
        return false;
    }

    const dueUtc = new Date(
        Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate())
    );
    const validUntilUtc = new Date(
        Date.UTC(
            coupon.validUntil.getUTCFullYear(),
            coupon.validUntil.getUTCMonth(),
            coupon.validUntil.getUTCDate()
        )
    );
    if (dueUtc > validUntilUtc) {
        return false;
    }

    const usedCount = await invoices.countByFinanceIdAndDiscountCouponId(financeId, coupon.id);
    return usedCount < coupon.durationMonths;
}
