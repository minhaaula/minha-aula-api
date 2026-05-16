import { describe, expect, it } from 'vitest';
import { DiscountCoupon } from '../../src/domain/entities/discount-coupon';
import { SchoolPlanInvoice } from '../../src/domain/entities/school-plan-invoice';
import { DiscountCouponRepository } from '../../src/ports/repositories/discount-coupon.repo';
import { SchoolPlanInvoiceRepository } from '../../src/ports/repositories/school-plan-invoice.repo';
import { resolvePlanInvoiceCoupon } from '../../src/app/utils/resolve-plan-invoice-coupon';

class InMemoryCouponRepo implements DiscountCouponRepository {
    private readonly items = new Map<string, DiscountCoupon>();

    async save(coupon: DiscountCoupon): Promise<void> {
        this.items.set(coupon.id, coupon);
    }

    async findByCode(code: string): Promise<DiscountCoupon | null> {
        const normalized = code.trim().toUpperCase();
        return Array.from(this.items.values()).find((c) => c.code === normalized) ?? null;
    }

    async findById(id: string): Promise<DiscountCoupon | null> {
        return this.items.get(id) ?? null;
    }

    async findAll(): Promise<DiscountCoupon[]> {
        return Array.from(this.items.values());
    }

    async delete(id: string): Promise<void> {
        this.items.delete(id);
    }

    seed(coupon: DiscountCoupon) {
        this.items.set(coupon.id, coupon);
    }
}

class InMemoryInvoiceRepo implements SchoolPlanInvoiceRepository {
    private readonly items = new Map<string, SchoolPlanInvoice>();

    async findById(id: string): Promise<SchoolPlanInvoice | null> {
        return this.items.get(id) ?? null;
    }

    async hasSchoolAnyPaidInvoice(): Promise<boolean> {
        return false;
    }

    async getSchoolIdsWithPaidInvoice(): Promise<Set<string>> {
        return new Set();
    }

    async findByFinanceIdAndDueDate(financeId: string, dueDate: Date): Promise<SchoolPlanInvoice | null> {
        const key = dueDate.toISOString().slice(0, 10);
        return (
            Array.from(this.items.values()).find(
                (i) => i.financeId === financeId && i.dueDate.toISOString().slice(0, 10) === key
            ) ?? null
        );
    }

    async findByProviderRef(): Promise<SchoolPlanInvoice | null> {
        return null;
    }

    async findByExternalReference(): Promise<SchoolPlanInvoice | null> {
        return null;
    }

    async findByFinanceId(financeId: string): Promise<SchoolPlanInvoice[]> {
        return Array.from(this.items.values()).filter((i) => i.financeId === financeId);
    }

    async countByFinanceIdAndDiscountCouponId(financeId: string, discountCouponId: string): Promise<number> {
        return Array.from(this.items.values()).filter(
            (i) => i.financeId === financeId && i.discountCouponId === discountCouponId
        ).length;
    }

    async findPaidWithoutReceiptUrl(): Promise<SchoolPlanInvoice[]> {
        return [];
    }

    async findIssuedWithProviderRef(): Promise<SchoolPlanInvoice[]> {
        return [];
    }

    async findIssuedByDueDateRange(): Promise<SchoolPlanInvoice[]> {
        return [];
    }

    async save(invoice: SchoolPlanInvoice): Promise<void> {
        this.items.set(invoice.id, invoice);
    }

    seed(invoice: SchoolPlanInvoice) {
        this.items.set(invoice.id, invoice);
    }
}

function makeCoupon(durationMonths: number): DiscountCoupon {
    return DiscountCoupon.create({
        id: 'coupon-1',
        code: 'PROMO',
        percentage: 50,
        validUntil: new Date('2026-12-31T23:59:59Z'),
        durationMonths
    });
}

function makeInvoice(financeId: string, dueDate: string, couponId: string | null = 'coupon-1'): SchoolPlanInvoice {
    return SchoolPlanInvoice.create({
        id: `inv-${dueDate}`,
        financeId,
        schoolId: 'school-1',
        planId: 'plan-1',
        amountCents: 5000,
        currency: 'BRL',
        dueDate: new Date(dueDate),
        description: 'Assinatura',
        providerRef: 'asaas-1',
        discountCouponId: couponId,
        discountPercentage: couponId ? 50 : null,
        discountAmountCents: couponId ? 5000 : 0,
        originalAmountCents: 10000
    });
}

describe('resolvePlanInvoiceCoupon', () => {
    it('applies explicit coupon on first invoice', async () => {
        const coupons = new InMemoryCouponRepo();
        const invoices = new InMemoryInvoiceRepo();
        coupons.seed(makeCoupon(3));

        const result = await resolvePlanInvoiceCoupon({
            financeId: 'finance-1',
            dueDate: new Date('2026-05-16'),
            explicitCouponCode: 'PROMO',
            coupons,
            invoices
        });

        expect(result?.code).toBe('PROMO');
    });

    it('reapplies coupon automatically on next cycle without explicit code', async () => {
        const coupons = new InMemoryCouponRepo();
        const invoices = new InMemoryInvoiceRepo();
        coupons.seed(makeCoupon(3));
        invoices.seed(makeInvoice('finance-1', '2026-05-16'));

        const result = await resolvePlanInvoiceCoupon({
            financeId: 'finance-1',
            dueDate: new Date('2026-06-16'),
            coupons,
            invoices
        });

        expect(result?.code).toBe('PROMO');
    });

    it('stops applying coupon after durationMonths is exhausted', async () => {
        const coupons = new InMemoryCouponRepo();
        const invoices = new InMemoryInvoiceRepo();
        coupons.seed(makeCoupon(2));
        invoices.seed(makeInvoice('finance-1', '2026-05-16'));
        invoices.seed(makeInvoice('finance-1', '2026-06-16'));

        const result = await resolvePlanInvoiceCoupon({
            financeId: 'finance-1',
            dueDate: new Date('2026-07-16'),
            coupons,
            invoices
        });

        expect(result).toBeNull();
    });
});
