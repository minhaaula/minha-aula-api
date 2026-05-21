import { DiscountCouponRepository } from '../../../ports/repositories/discount-coupon.repo';

export interface ListDiscountCouponsOutput {
    coupons: Array<{
        id: string;
        code: string;
        percentage: number;
        validUntil: Date;
        durationMonths: number;
        isActive: boolean;
        createdAt: Date;
        isValid: boolean;
    }>;
}

export class ListDiscountCoupons {
    constructor(
        private readonly coupons: DiscountCouponRepository
    ) {}

    async exec(): Promise<ListDiscountCouponsOutput> {
        const coupons = await this.coupons.findAll();
        
        return {
            coupons: coupons.map(coupon => ({
                id: coupon.id,
                code: coupon.code,
                percentage: coupon.percentage,
                validUntil: coupon.validUntil,
                durationMonths: coupon.durationMonths,
                isActive: coupon.isActive,
                createdAt: coupon.createdAt,
                isValid: coupon.isValid()
            }))
        };
    }
}

