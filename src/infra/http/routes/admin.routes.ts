import { Router } from 'express';
import { GetAdminStatus } from '../../../app/use-cases/get-admin-status';

type AdminRouterDeps = {
    getAdminStatus: GetAdminStatus;
};

export function adminRouter({ getAdminStatus }: AdminRouterDeps) {
    const router = Router();

    router.get('/status', async (_req, res, next) => {
        try {
            const payload = await Promise.resolve(getAdminStatus.exec());
            res.json(payload);
        } catch (err) {
            next(err);
        }
    });

    return router;
}
