import { DiscountCouponRepository } from '../../ports/repositories/discount-coupon.repo';
import { AppError, ErrorCode } from '../../shared/errors';

export interface ValidateDiscountCouponInput {
    code: string;
}

export interface ValidateDiscountCouponOutput {
    isValid: boolean;
    coupon?: {
        id: string;
        code: string;
        percentage: number;
        validUntil: Date;
        durationMonths: number;
    };
    error?: string;
}

export class ValidateDiscountCoupon {
    constructor(
        private readonly coupons: DiscountCouponRepository
    ) {}

    async exec(input: ValidateDiscountCouponInput): Promise<ValidateDiscountCouponOutput> {
        const code = input.code.trim().toUpperCase();
        if (!code) {
            return {
                isValid: false,
                error: 'Código do cupom é obrigatório'
            };
        }

        const coupon = await this.coupons.findByCode(code);
        if (!coupon) {
            return {
                isValid: false,
                error: 'Cupom não encontrado'
            };
        }

        if (!coupon.isValid()) {
            if (coupon.isExpired()) {
                return {
                    isValid: false,
                    error: 'Cupom expirado'
                };
            }
            if (!coupon.isActive) {
                return {
                    isValid: false,
                    error: 'Cupom inativo'
                };
            }
            return {
                isValid: false,
                error: 'Cupom inválido'
            };
        }

        return {
            isValid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                percentage: coupon.percentage,
                validUntil: coupon.validUntil,
                durationMonths: coupon.durationMonths
            }
        };
    }
}

