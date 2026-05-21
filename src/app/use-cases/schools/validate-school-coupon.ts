import { DiscountCouponRepository } from '../../../ports/repositories/discount-coupon.repo';
import { SubscriptionPlanRepository } from '../../../ports/repositories/subscription-plan.repo';
import { AppError, ErrorCode } from '../../../shared/errors';

export interface ValidateSchoolCouponInput {
    couponCode: string;
    planId?: string;
}

export interface ValidateSchoolCouponOutput {
    isValid: boolean;
    coupon?: {
        id: string;
        code: string;
        percentage: number;
        validUntil: Date;
        durationMonths: number;
    };
    discount?: {
        percentage: number;
        originalAmountCents: number;
        discountAmountCents: number;
        finalAmountCents: number;
        currency: string;
    };
    error?: string;
}

export class ValidateSchoolCoupon {
    constructor(
        private readonly coupons: DiscountCouponRepository,
        private readonly plans?: SubscriptionPlanRepository
    ) {}

    async exec(input: ValidateSchoolCouponInput): Promise<ValidateSchoolCouponOutput> {
        const code = input.couponCode.trim().toUpperCase();
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

        const result: ValidateSchoolCouponOutput = {
            isValid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                percentage: coupon.percentage,
                validUntil: coupon.validUntil,
                durationMonths: coupon.durationMonths
            }
        };

        // Se planId foi fornecido, calcular desconto
        if (input.planId && this.plans) {
            const plan = await this.plans.findById(input.planId);
            if (!plan) {
                throw AppError.fromCode(ErrorCode.NOT_FOUND, {
                    message: 'Plano não encontrado'
                });
            }

            const originalAmountCents = plan.amountCents;
            const discountAmountCents = coupon.calculateDiscount(originalAmountCents);
            const finalAmountCents = coupon.calculateDiscountedAmount(originalAmountCents);

            result.discount = {
                percentage: coupon.percentage,
                originalAmountCents,
                discountAmountCents,
                finalAmountCents,
                currency: plan.currency
            };
        }

        return result;
    }
}

