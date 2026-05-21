import { DiscountCouponRepository } from '../../../ports/repositories/discount-coupon.repo';
import { DiscountCoupon } from '../../../domain/entities/discount-coupon';
import { Uuid } from '../../../shared/uuid';
import { AppError, ErrorCode } from '../../../shared/errors';

export interface CreateDiscountCouponInput {
    code: string;
    percentage: number;
    validUntil: Date;
    durationMonths: number;
    isActive?: boolean;
}

export interface CreateDiscountCouponOutput {
    id: string;
    code: string;
    percentage: number;
    validUntil: Date;
    durationMonths: number;
    isActive: boolean;
    createdAt: Date;
}

export class CreateDiscountCoupon {
    constructor(
        private readonly coupons: DiscountCouponRepository
    ) {}

    async exec(input: CreateDiscountCouponInput): Promise<CreateDiscountCouponOutput> {
        const code = input.code.trim().toUpperCase();
        
        // Verificar se código já existe
        const existing = await this.coupons.findByCode(code);
        if (existing) {
            throw AppError.fromCode(ErrorCode.ALREADY_EXISTS, {
                message: 'Código de cupom já existe',
                code
            });
        }

        const validUntil = new Date(input.validUntil);
        if (Number.isNaN(validUntil.getTime())) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Data de validade inválida'
            });
        }

        if (validUntil < new Date()) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Data de validade não pode ser no passado'
            });
        }

        const coupon = DiscountCoupon.create({
            id: Uuid(),
            code,
            percentage: input.percentage,
            validUntil,
            durationMonths: input.durationMonths,
            isActive: input.isActive ?? true
        });

        await this.coupons.save(coupon);

        return {
            id: coupon.id,
            code: coupon.code,
            percentage: coupon.percentage,
            validUntil: coupon.validUntil,
            durationMonths: coupon.durationMonths,
            isActive: coupon.isActive,
            createdAt: coupon.createdAt
        };
    }
}

