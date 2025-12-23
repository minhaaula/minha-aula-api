import { DiscountCoupon } from '../../domain/entities/discount-coupon';

export interface DiscountCouponRepository {
    save(coupon: DiscountCoupon): Promise<void>;
    findByCode(code: string): Promise<DiscountCoupon | null>;
    findById(id: string): Promise<DiscountCoupon | null>;
    findAll(): Promise<DiscountCoupon[]>;
    delete(id: string): Promise<void>;
}

