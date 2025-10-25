import { Router } from 'express';
import { z } from 'zod';
import { ListStudents } from '../../../app/use-cases/list-students';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AuthenticatedRequest } from '../middlewares/auth';

export function studentsRouter(deps: { listStudents: ListStudents; }) {
    const r = Router();

    const canListStudents = requirePersona(UserPersonaEnum.ADMIN, UserPersonaEnum.SCHOOL);
    const querySchema = z.object({
        cpf: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).optional(),
        courseId: z.string().uuid().optional()
    });

    r.get('/', canListStudents, async (req, res, next) => {
        try {
            const authReq = req as AuthenticatedRequest;
            const persona = authReq.user?.persona;
            const schoolId = persona === UserPersonaEnum.SCHOOL && typeof authReq.user?.schoolId === 'string'
                ? authReq.user.schoolId
                : undefined;

            if (persona === UserPersonaEnum.SCHOOL && !schoolId) {
                return res.status(403).json({ error: 'School context not found for user' });
            }

            const parsedQuery = querySchema.parse({
                cpf: typeof req.query.cpf === 'string' ? req.query.cpf : undefined,
                name: typeof req.query.name === 'string' ? req.query.name : undefined,
                courseId: typeof req.query.courseId === 'string' ? req.query.courseId : undefined
            });

            const students = await deps.listStudents.exec({
                cpf: parsedQuery.cpf,
                name: parsedQuery.name,
                courseId: parsedQuery.courseId,
                schoolId
            });
            res.json({ students });
        } catch (err) {
            next(err);
        }
    });

    r.get('/directory/:cpf', canListStudents, async (req, res, next) => {
        try {
            const authReq = req as AuthenticatedRequest;
            const persona = authReq.user?.persona;

            if (persona === UserPersonaEnum.SCHOOL && typeof authReq.user?.schoolId !== 'string') {
                return res.status(403).json({ error: 'School context not found for user' });
            }

            const paramsSchema = z.object({ cpf: z.string().trim().min(1) });
            const { cpf } = paramsSchema.parse(req.params);

            const students = await deps.listStudents.exec({
                cpf
            });
            res.json({ students: students.length > 0 ? [students[0]] : [] });
        } catch (err) {
            next(err);
        }
    });

    return r;
}
