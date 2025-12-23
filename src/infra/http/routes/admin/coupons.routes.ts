import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { RequestHandler } from 'express';
import { requirePersona } from '../../middlewares/require-persona';
import { UserPersonaEnum } from '../../../../domain/value-objects/user-persona';
import type { CreateDiscountCoupon } from '../../../../app/use-cases/create-discount-coupon';
import type { ListDiscountCoupons } from '../../../../app/use-cases/list-discount-coupons';
import type { ValidateDiscountCoupon } from '../../../../app/use-cases/validate-discount-coupon';
import { z } from 'zod';

const createCouponSchema = z.object({
    code: z.string().trim().min(3).max(50),
    percentage: z.number().min(1).max(100),
    validUntil: z.string().datetime(),
    durationMonths: z.number().int().min(1),
    isActive: z.boolean().optional()
});

const validateCouponSchema = z.object({
    code: z.string().trim().min(1)
});

export interface CouponsRoutesDeps {
    createDiscountCoupon?: CreateDiscountCoupon;
    listDiscountCoupons?: ListDiscountCoupons;
    validateDiscountCoupon?: ValidateDiscountCoupon;
}

export function buildCouponsRoutes(deps: CouponsRoutesDeps, authMiddleware?: RequestHandler) {
    const router = Router();
    const requireAuth = authMiddleware || ((_req, _res, next) => next());
    const requireAdmin = requirePersona(UserPersonaEnum.ADMIN);

    if (deps.createDiscountCoupon) {
        router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
            const data = createCouponSchema.parse(req.body);
            const result = await deps.createDiscountCoupon!.exec({
                code: data.code,
                percentage: data.percentage,
                validUntil: new Date(data.validUntil),
                durationMonths: data.durationMonths,
                isActive: data.isActive
            });
            res.status(201).json(result);
        }));
    }

    if (deps.listDiscountCoupons) {
        router.get('/', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
            const result = await deps.listDiscountCoupons!.exec();
            res.json(result);
        }));
    }

    if (deps.validateDiscountCoupon) {
        router.post('/validate', requireAuth, asyncHandler(async (req, res) => {
            const data = validateCouponSchema.parse(req.body);
            const result = await deps.validateDiscountCoupon!.exec({ code: data.code });
            res.json(result);
        }));
    }

    return router;
}

