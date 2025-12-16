import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { RegisterUser } from '../../../app/use-cases/register-user';
import { LoginUser } from '../../../app/use-cases/login-user';
import { RefreshToken } from '../../../app/use-cases/refresh-token';
import { USER_PERSONAS } from '../../../domain/value-objects/user-persona';
import { UpdateUserPassword } from '../../../app/use-cases/update-user-password';
import { RequestUserPasswordReset } from '../../../app/use-cases/request-user-password-reset';
import { ResetUserPassword } from '../../../app/use-cases/reset-user-password';
import { ValidatePasswordResetToken } from '../../../app/use-cases/validate-password-reset-token';
import { AuthenticatedRequest } from '../middlewares/auth';
import { cpfNumberSchema, phoneNumberSchema, zipCodeNumberSchema } from '../validators/numeric-fields';

const cpfSchema = cpfNumberSchema();

export function authRouter({
    registerUser,
    loginUser,
    refreshToken,
    updateUserPassword,
    requestUserPasswordReset,
    resetUserPassword,
    validatePasswordResetToken,
    authMiddleware
}: {
    registerUser: RegisterUser;
    loginUser: LoginUser;
    refreshToken?: RefreshToken;
    updateUserPassword: UpdateUserPassword;
    requestUserPasswordReset?: RequestUserPasswordReset;
    resetUserPassword?: ResetUserPassword;
    validatePasswordResetToken?: ValidatePasswordResetToken;
    authMiddleware?: RequestHandler;
}) {
    const r = Router();
    const requireAuth: RequestHandler = authMiddleware ?? ((_req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
    });

    const addressSchema = z.object({
        street: z.string().min(3),
        number: z.string().min(1),
        complement: z.string().min(1).optional(),
        district: z.string().min(2).optional(),
        city: z.string().min(2),
        state: z.string().min(2),
        zipCode: zipCodeNumberSchema()
    });

    const registerSchema = z.object({
        fullName: z.string().min(3),
        birthDate: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Invalid birth date' }),
        email: z.string().email(),
        phone: phoneNumberSchema(),
        cpf: cpfSchema,
        address: addressSchema,
        persona: z.enum(USER_PERSONAS),
        password: z.string().min(8)
    });

    const loginSchema = z.object({
        cpf: cpfSchema,
        password: z.string().min(8)
    });

    const updatePasswordSchema = z.object({
        currentPassword: z.string().min(8),
        newPassword: z.string().min(8)
    });

    r.post('/register', async (req, res, next) => {
        try {
            const dto = registerSchema.parse(req.body);
            const result = await registerUser.exec(dto);
            res.status(201).json(result);
        } catch (e) {
            next(e);
        }
    });

    r.post('/login', async (req, res, next) => {
        try {
            const dto = loginSchema.parse(req.body);
            const result = await loginUser.exec(dto);
            res.json(result);
        } catch (e) {
            next(e);
        }
    });

    if (refreshToken) {
        const refreshTokenSchema = z.object({
            refreshToken: z.string().min(1, 'Refresh token é obrigatório')
        });

        r.post('/refresh', async (req, res, next) => {
            try {
                const dto = refreshTokenSchema.parse(req.body);
                const result = await refreshToken.exec(dto);
                res.json(result);
            } catch (e) {
                next(e);
            }
        });
    }

    r.patch('/password', requireAuth, async (req, res, next) => {
        try {
            const dto = updatePasswordSchema.parse(req.body);
            const authReq = req as AuthenticatedRequest;
            const userId = authReq.user?.sub;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            await updateUserPassword.exec({
                userId,
                currentPassword: dto.currentPassword,
                newPassword: dto.newPassword
            });
            res.status(204).send();
        } catch (e) {
            next(e);
        }
    });

    // Rotas de reset de senha (públicas)
    if (requestUserPasswordReset) {
        const requestResetSchema = z.object({
            email: z.string().email('Email inválido')
        });

        r.post('/password/request', async (req, res, next) => {
            try {
                const dto = requestResetSchema.parse(req.body);
                const result = await requestUserPasswordReset.exec(dto);
                res.json(result);
            } catch (e) {
                next(e);
            }
        });
    }

    if (resetUserPassword) {
        const resetPasswordSchema = z.object({
            token: z.string().min(1, 'Token é obrigatório'),
            newPassword: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres')
        });

        r.post('/password/reset', async (req, res, next) => {
            try {
                const dto = resetPasswordSchema.parse(req.body);
                const result = await resetUserPassword.exec(dto);
                res.json(result);
            } catch (e) {
                next(e);
            }
        });
    }

    if (validatePasswordResetToken) {
        const validateTokenSchema = z.object({
            token: z.string().min(1, 'Token é obrigatório')
        });

        r.post('/password/validate', async (req, res, next) => {
            try {
                const dto = validateTokenSchema.parse(req.body);
                const result = await validatePasswordResetToken.exec(dto);
                res.json(result);
            } catch (e) {
                next(e);
            }
        });
    }

    return r;
}
