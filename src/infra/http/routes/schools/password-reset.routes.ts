import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { RequestPhoneOtpChallenge } from '../../../../app/use-cases/auth/request-phone-otp-challenge';
import type { VerifyPhoneOtpChallenge } from '../../../../app/use-cases/auth/verify-phone-otp-challenge';
import type { ResetPassword } from '../../../../app/use-cases/auth/reset-password';
import type { ValidatePasswordResetToken } from '../../../../app/use-cases/auth/validate-password-reset-token';

type PasswordResetRoutesDeps = {
    requestSchoolPasswordPhoneOtp?: RequestPhoneOtpChallenge;
    verifySchoolPasswordPhoneOtp?: VerifyPhoneOtpChallenge;
    resetPassword?: ResetPassword;
    validatePasswordResetToken?: ValidatePasswordResetToken;
};

export function buildPasswordResetRoutes(deps: PasswordResetRoutesDeps) {
    const router = Router();

    if (deps.requestSchoolPasswordPhoneOtp) {
        router.post('/otp/request', asyncHandler(async (req, res) => {
            const data = schoolOtpRequestSchema.parse(req.body);
            const result = await deps.requestSchoolPasswordPhoneOtp!.exec({
                purpose: 'school_password_reset',
                email: data.email
            });
            const status = 'challengeId' in result ? 201 : 200;
            res.status(status).json(result);
        }));
    }

    if (deps.verifySchoolPasswordPhoneOtp) {
        router.post('/otp/verify', asyncHandler(async (req, res) => {
            const data = schoolOtpVerifySchema.parse(req.body);
            const result = await deps.verifySchoolPasswordPhoneOtp!.exec(data);
            res.json(result);
        }));
    }

    if (deps.resetPassword) {
        router.post('/reset', asyncHandler(async (req, res) => {
            const data = resetPasswordSchema.parse(req.body);
            const result = await deps.resetPassword!.exec(data);
            res.json(result);
        }));
    }

    if (deps.validatePasswordResetToken) {
        router.post('/validate', asyncHandler(async (req, res) => {
            const data = validateTokenSchema.parse(req.body);
            const result = await deps.validatePasswordResetToken!.exec(data);
            res.json(result);
        }));
    }

    return router;
}

const schoolOtpRequestSchema = z.object({
    email: z.string().email('Email inválido')
});

const schoolOtpVerifySchema = z.object({
    challengeId: z.string().uuid(),
    code: z.string().trim().regex(/^\d{4,8}$/)
});

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token é obrigatório'),
    newPassword: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres')
});

const validateTokenSchema = z.object({
    token: z.string().min(1, 'Token é obrigatório')
});
