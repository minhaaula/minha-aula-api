import { Router } from 'express';
import { z } from 'zod';
import { RegisterUser } from 'src/app/use-cases/register-user';
import { LoginUser } from 'src/app/use-cases/login-user';

export function authRouter({ registerUser, loginUser }: { registerUser: RegisterUser; loginUser: LoginUser; }) {
    const r = Router();

    const registerSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8)
    });

    const loginSchema = z.object({
        email: z.string().email(),
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
