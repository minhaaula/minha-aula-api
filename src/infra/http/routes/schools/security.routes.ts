import { Router } from 'express';
import { z } from 'zod';
import type { RequestSchoolActionOtp } from '../../../../app/use-cases/schools/request-school-action-otp';
import type { VerifySchoolActionOtp } from '../../../../app/use-cases/schools/verify-school-action-otp';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';
import { asyncHandler } from '../../utils/async-handler';
import type { SchoolRouteGuards } from './guards';

const requestOtpSchema = z.object({
    purpose: z.enum(['WITHDRAWAL', 'BANK_ACCOUNT_CHANGE'])
});

const verifyOtpSchema = z.object({
    challengeId: z.string().uuid(),
    code: z.string().trim().regex(/^\d{4,8}$/)
});

type SecurityRoutesDeps = {
    requestSchoolActionOtp?: RequestSchoolActionOtp;
    verifySchoolActionOtp?: VerifySchoolActionOtp;
};

export function buildSecurityRoutes(deps: SecurityRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();
    const protectedMiddleware = [guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext] as const;

    if (deps.requestSchoolActionOtp) {
        router.post('/otp/request', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const body = requestOtpSchema.parse(req.body ?? {});
            const result = await deps.requestSchoolActionOtp!.exec({
                schoolId,
                purpose: body.purpose
            });

            res.status(201).json({
                challengeId: result.challengeId,
                purpose: result.purpose,
                expiresAt: result.expiresAt.toISOString()
            });
        }));
    }

    if (deps.verifySchoolActionOtp) {
        router.post('/otp/verify', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const body = verifyOtpSchema.parse(req.body ?? {});
            const result = await deps.verifySchoolActionOtp!.exec({
                schoolId,
                challengeId: body.challengeId,
                code: body.code
            });

            res.json({
                challengeId: result.challengeId,
                purpose: result.purpose,
                verified: result.verified,
                verifiedAt: result.verifiedAt.toISOString()
            });
        }));
    }

    return router;
}
