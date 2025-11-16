import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { RequestPasswordReset } from '../../../../app/use-cases/request-password-reset';
import type { ResetPassword } from '../../../../app/use-cases/reset-password';

type PasswordResetRoutesDeps = {
    requestPasswordReset?: RequestPasswordReset;
    resetPassword?: ResetPassword;
};

export function buildPasswordResetRoutes(deps: PasswordResetRoutesDeps) {
    const router = Router();

    if (deps.requestPasswordReset) {
        router.post('/request', asyncHandler(async (req, res) => {
            const data = requestPasswordResetSchema.parse(req.body);
            const result = await deps.requestPasswordReset!.exec(data);
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

    return router;
}

const requestPasswordResetSchema = z.object({
    email: z.string().email('Email inválido')
});

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token é obrigatório'),
    newPassword: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres')
});

