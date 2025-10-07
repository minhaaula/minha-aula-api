import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { RegisterUser } from '../../../app/use-cases/register-user';
import { LoginUser } from '../../../app/use-cases/login-user';
import { USER_PERSONAS } from '../../../domain/value-objects/user-persona';
import { UpdateUserPassword } from '../../../app/use-cases/update-user-password';
import { AuthenticatedRequest } from '../middlewares/auth';

const cpfSchema = z.string()
    .min(11)
    .transform((value) => value.replace(/[^\d]/g, ''))
    .refine((value) => value.length === 11, { message: 'Invalid CPF' });

export function authRouter({
    registerUser,
    loginUser,
    updateUserPassword,
    authMiddleware
}: {
    registerUser: RegisterUser;
    loginUser: LoginUser;
    updateUserPassword: UpdateUserPassword;
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
        zipCode: z.string().min(5)
    }).transform((value) => ({
        ...value,
        zipCode: value.zipCode.replace(/[^\d]/g, '')
    }));

    const registerSchema = z.object({
        fullName: z.string().min(3),
        birthDate: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Invalid birth date' }),
        email: z.string().email(),
        phone: z.string().min(8),
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

    return r;
}
