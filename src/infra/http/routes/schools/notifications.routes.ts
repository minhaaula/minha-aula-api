import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { ListSchoolNotifications } from '../../../../app/use-cases/list-school-notifications';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';

type NotificationsRoutesDeps = {
    listSchoolNotifications: ListSchoolNotifications;
};

export function buildNotificationsRoutes(deps: NotificationsRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

    const querySchema = z.object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional()
    });

    router.get('/', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        const query = querySchema.parse({
            limit: req.query.limit,
            offset: req.query.offset
        });

        const result = await deps.listSchoolNotifications.exec({
            schoolId,
            limit: query.limit,
            offset: query.offset
        });

        res.json(result);
    }));

    return router;
}

