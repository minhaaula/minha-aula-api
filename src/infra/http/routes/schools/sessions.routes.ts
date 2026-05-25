import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { ListClassSessions } from '../../../../app/use-cases/courses/list-class-sessions';
import type { CancelClassSession } from '../../../../app/use-cases/courses/cancel-class-session';
import { listClassSessionsQuerySchema, sessionIdParamsSchema } from '../../validators/school-schemas';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';

type SessionsRoutesDeps = {
    listClassSessions: ListClassSessions;
    cancelClassSession: CancelClassSession;
};

export function buildSessionsRoutes(deps: SessionsRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

    router.get('/sessions', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const { from, to, courseClassId } = listClassSessionsQuerySchema.parse(req.query);
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        const sessions = await deps.listClassSessions.exec({
            schoolId,
            from: new Date(from),
            to: new Date(to),
            courseClassId: courseClassId ?? null
        });
        res.json({ sessions });
    }));

    router.delete('/sessions/:sessionId', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const { sessionId } = sessionIdParamsSchema.parse(req.params);
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        await deps.cancelClassSession.exec({ schoolId, sessionId });
        res.status(204).send();
    }));

    return router;
}
