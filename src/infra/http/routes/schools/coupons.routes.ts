import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { ValidateSchoolCoupon } from '../../../../app/use-cases/schools/validate-school-coupon';
import { z } from 'zod';
import type { SchoolRouteGuards } from './guards';

const validateCouponSchema = z.object({
    couponCode: z.string().trim().min(3).max(50),
    planId: z.string().uuid().optional()
});

export interface CouponsRoutesDeps {
    validateSchoolCoupon?: ValidateSchoolCoupon;
}

export function buildCouponsRoutes(deps: CouponsRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    if (deps.validateSchoolCoupon) {
        router.post('/validate', guards.requireAuth, guards.requireSchoolPersona, asyncHandler(async (req, res) => {
            const data = validateCouponSchema.parse(req.body);
            const result = await deps.validateSchoolCoupon!.exec({
                couponCode: data.couponCode,
                planId: data.planId
            });
            res.json(result);
        }));
    }

    return router;
}

