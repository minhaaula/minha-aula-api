import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { ListSchoolStudents } from '../../../../app/use-cases/list-school-students';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';

type StudentsRoutesDeps = {
    listSchoolStudents: ListSchoolStudents;
};

export function buildStudentsRoutes(deps: StudentsRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

    const querySchema = z.object({
        name: z.string().trim().min(1).optional(),
        courseId: z.string().uuid().optional(),
        classId: z.string().uuid().optional()
    });

    router.get('/', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        const query = querySchema.parse({
            name: typeof req.query.name === 'string' ? req.query.name : undefined,
            courseId: typeof req.query.courseId === 'string' ? req.query.courseId : undefined,
            classId: typeof req.query.classId === 'string' ? req.query.classId : undefined
        });

        const students = await deps.listSchoolStudents.exec({
            schoolId,
            name: query.name,
            courseId: query.courseId,
            classId: query.classId
        });

        res.json({ students });
    }));

    return router;
}
