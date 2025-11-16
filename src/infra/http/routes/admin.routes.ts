import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler';
import { GetAdminStatus } from '../../../app/use-cases/get-admin-status';
import { ListSchoolsWithPlans } from '../../../app/use-cases/list-schools-with-plans';
import { LoginAdmin } from '../../../app/use-cases/login-admin';
import { GetAdminDashboard } from '../../../app/use-cases/get-admin-dashboard';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';

type AdminRouterDeps = {
    getAdminStatus: GetAdminStatus;
    listSchoolsWithPlans: ListSchoolsWithPlans;
    loginAdmin: LoginAdmin;
    getAdminDashboard?: GetAdminDashboard;
    authMiddleware?: RequestHandler;
};

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});

function buildAuthGuards(authMiddleware?: RequestHandler) {
    const requireAuth: RequestHandler = authMiddleware ?? ((_req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
    });
    return { requireAuth };
}

export function adminRouter({ getAdminStatus, listSchoolsWithPlans, loginAdmin, getAdminDashboard, authMiddleware }: AdminRouterDeps) {
    const router = Router();
    const { requireAuth } = buildAuthGuards(authMiddleware);
    const requireAdminPersona = requirePersona(UserPersonaEnum.ADMIN);

    // Rota pública de login
    router.post('/login', asyncHandler(async (req, res, next) => {
        try {
            const dto = loginSchema.parse(req.body);
            const result = await loginAdmin.exec(dto);
            res.json(result);
        } catch (e) {
            next(e);
        }
    }));

    // Rotas protegidas - requerem autenticação e persona ADMIN
    router.get('/status', requireAuth, requireAdminPersona, asyncHandler(async (_req, res) => {
        const payload = await Promise.resolve(getAdminStatus.exec());
        res.json(payload);
    }));

    router.get('/schools', requireAuth, requireAdminPersona, asyncHandler(async (_req, res) => {
        const schools = await listSchoolsWithPlans.exec();
        res.json({ schools });
    }));

    if (getAdminDashboard) {
        router.get('/dashboard', requireAuth, requireAdminPersona, asyncHandler(async (_req, res) => {
            const dashboard = await getAdminDashboard.exec();
            res.json(dashboard);
        }));
    }

    return router;
}
