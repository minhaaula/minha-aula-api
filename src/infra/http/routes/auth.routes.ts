import { Router } from 'express';
import { z } from 'zod';
import { RegisterUser } from '../../../app/use-cases/register-user';
import { LoginUser } from '../../../app/use-cases/login-user';
import { USER_PERSONAS } from '../../../domain/value-objects/user-persona';

const cpfSchema = z.string()
    .min(11)
    .transform((value) => value.replace(/[^\d]/g, ''))
    .refine((value) => value.length === 11, { message: 'Invalid CPF' });

export function authRouter({ registerUser, loginUser }: { registerUser: RegisterUser; loginUser: LoginUser; }) {
    const r = Router();

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

    return r;
}
