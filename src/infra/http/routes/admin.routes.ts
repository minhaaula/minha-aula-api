import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { GetAdminStatus } from '../../../app/use-cases/get-admin-status';
import { ListSchoolsWithPlans } from '../../../app/use-cases/list-schools-with-plans';

type AdminRouterDeps = {
    getAdminStatus: GetAdminStatus;
    listSchoolsWithPlans: ListSchoolsWithPlans;
};

export function adminRouter({ getAdminStatus, listSchoolsWithPlans }: AdminRouterDeps) {
    const router = Router();

    router.get('/status', asyncHandler(async (_req, res) => {
        const payload = await Promise.resolve(getAdminStatus.exec());
        res.json(payload);
    }));

    router.get('/schools', asyncHandler(async (_req, res) => {
        const schools = await listSchoolsWithPlans.exec();
        res.json({ schools });
    }));

    return router;
}
