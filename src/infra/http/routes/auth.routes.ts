import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { RegisterUser } from '../../../app/use-cases/auth/register-user';
import { LoginUser } from '../../../app/use-cases/auth/login-user';
import { RefreshToken } from '../../../app/use-cases/auth/refresh-token';
import { USER_PERSONAS } from '../../../domain/value-objects/user-persona';
import { UpdateUserPassword } from '../../../app/use-cases/auth/update-user-password';
import type { RequestPhoneOtpChallenge } from '../../../app/use-cases/auth/request-phone-otp-challenge';
import type { VerifyPhoneOtpChallenge } from '../../../app/use-cases/auth/verify-phone-otp-challenge';
import { ResetUserPassword } from '../../../app/use-cases/auth/reset-user-password';
import { ValidatePasswordResetToken } from '../../../app/use-cases/auth/validate-password-reset-token';
import { AuthenticatedRequest } from '../middlewares/auth';
import { cpfNumberSchema, phoneNumberSchema } from '../validators/numeric-fields';
import { addressSchema } from '../validators/common-schemas';
import { optionalGenderSchema } from '../validators/gender-schemas';
import { parseLoginAppClient } from '../validators/app-client-schemas';
import { authRateLimiter, registrationRateLimiter } from '../middlewares/rate-limiter';

const cpfSchema = cpfNumberSchema();

export function authRouter({
    registerUser,
    loginUser,
    refreshToken,
    updateUserPassword,
    requestPhoneOtp,
    verifyPhoneOtp,
    resetUserPassword,
    validatePasswordResetToken,
    authMiddleware
}: {
    registerUser: RegisterUser;
    loginUser: LoginUser;
    refreshToken?: RefreshToken;
    updateUserPassword: UpdateUserPassword;
    requestPhoneOtp?: RequestPhoneOtpChallenge;
    verifyPhoneOtp?: VerifyPhoneOtpChallenge;
    resetUserPassword?: ResetUserPassword;
    validatePasswordResetToken?: ValidatePasswordResetToken;
    authMiddleware?: RequestHandler;
}) {
    const r = Router();
    const requireAuth: RequestHandler = authMiddleware ?? ((_req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
    });

    const registerSchema = z.object({
        fullName: z.string().min(3),
        birthDate: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Invalid birth date' }),
        email: z.string().email(),
        phone: phoneNumberSchema(),
        cpf: cpfSchema,
        address: addressSchema,
        persona: z.enum(USER_PERSONAS),
        password: z.string().min(8),
        phoneVerificationToken: z.string().min(1, 'Confirme o telefone no WhatsApp antes de cadastrar'),
        gender: optionalGenderSchema
    });

    const loginSchema = z
        .object({
            cpf: cpfSchema,
            password: z.string().min(8),
            platform: z.union([z.enum(['ANDROID', 'IOS']), z.string()]).optional(),
            appVersion: z.string().trim().min(1).max(32).optional(),
            app_version: z.string().trim().min(1).max(32).optional(),
            osVersion: z.string().trim().min(1).max(64).optional(),
            os_version: z.string().trim().min(1).max(64).optional(),
            notificationsEnabled: z.union([z.boolean(), z.number(), z.string()]).optional(),
            notifications_enabled: z.union([z.boolean(), z.number(), z.string()]).optional(),
            appClient: z.object({}).passthrough().optional()
        })
        .passthrough();

    const updatePasswordSchema = z.object({
        currentPassword: z.string().min(8),
        newPassword: z.string().min(8)
    });

    const verificationRequestSchema = z.discriminatedUnion('purpose', [
        z.object({
            purpose: z.literal('signup'),
            phone: phoneNumberSchema()
        }),
        z.object({
            purpose: z.literal('user_password_reset'),
            cpf: cpfSchema
        })
    ]);

    const verificationVerifySchema = z.object({
        challengeId: z.string().uuid(),
        code: z.string().trim().regex(/^\d{4,8}$/)
    });

    if (requestPhoneOtp) {
        r.post('/verification/request', registrationRateLimiter, async (req, res, next) => {
            try {
                const dto = verificationRequestSchema.parse(req.body);
                const result = await requestPhoneOtp.exec(dto);
                const status = 'challengeId' in result ? 201 : 200;
                res.status(status).json(result);
            } catch (e) {
                next(e);
            }
        });
    }

    if (verifyPhoneOtp) {
        r.post('/verification/verify', authRateLimiter, async (req, res, next) => {
            try {
                const dto = verificationVerifySchema.parse(req.body);
                const result = await verifyPhoneOtp.exec(dto);
                res.json(result);
            } catch (e) {
                next(e);
            }
        });
    }

    r.post('/register', registrationRateLimiter, async (req, res, next) => {
        try {
            const dto = registerSchema.parse(req.body);
            const result = await registerUser.exec(dto);
            res.status(201).json(result);
        } catch (e) {
            next(e);
        }
    });

    r.post('/login', authRateLimiter, async (req, res, next) => {
        try {
            const rawBody = req.body ?? {};
            const dto = loginSchema.parse(rawBody);
            const appClient = parseLoginAppClient(rawBody);
            const result = await loginUser.exec({
                cpf: dto.cpf,
                password: dto.password,
                appClient
            });
            res.json(result);
        } catch (e) {
            next(e);
        }
    });

    const refreshBodySchema = z
        .object({
            refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
            platform: z.union([z.enum(['ANDROID', 'IOS']), z.string()]).optional(),
            appVersion: z.string().trim().min(1).max(32).optional(),
            app_version: z.string().trim().min(1).max(32).optional(),
            osVersion: z.string().trim().min(1).max(64).optional(),
            os_version: z.string().trim().min(1).max(64).optional(),
            notificationsEnabled: z.union([z.boolean(), z.number(), z.string()]).optional(),
            notifications_enabled: z.union([z.boolean(), z.number(), z.string()]).optional(),
            appClient: z.object({}).passthrough().optional()
        })
        .passthrough();

    if (refreshToken) {
        r.post('/refresh', async (req, res, next) => {
            try {
                const rawBody = req.body ?? {};
                const dto = refreshBodySchema.parse(rawBody);
                const appClient = parseLoginAppClient(rawBody);
                const result = await refreshToken.exec({
                    refreshToken: dto.refreshToken,
                    appClient
                });
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

    if (resetUserPassword) {
        const resetPasswordSchema = z.object({
            token: z.string().min(1, 'Token é obrigatório'),
            newPassword: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres')
        });

        r.post('/password/reset', authRateLimiter, async (req, res, next) => {
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
