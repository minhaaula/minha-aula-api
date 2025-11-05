import { Router } from 'express';
import { z } from 'zod';
import { ListStudents } from '../../../app/use-cases/list-students';
import { GetStudentDirectoryEntry } from '../../../app/use-cases/get-student-directory-entry';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AuthenticatedRequest } from '../middlewares/auth';

export function studentsRouter(deps: { listStudents: ListStudents; getStudentDirectoryEntry: GetStudentDirectoryEntry; }) {
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
                return res.status(403).json({ 
                    error: 'Contexto de escola não encontrado para o usuário',
                    code: 'SCHOOL_CONTEXT_NOT_FOUND'
                });
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
                return res.status(403).json({ 
                    error: 'Contexto de escola não encontrado para o usuário',
                    code: 'SCHOOL_CONTEXT_NOT_FOUND'
                });
            }

            const paramsSchema = z.object({ cpf: z.string().trim().min(1) });
            const { cpf } = paramsSchema.parse(req.params);

            const entry = await deps.getStudentDirectoryEntry.exec({ cpf });
            if (!entry) {
                return res.status(404).json({ 
                    error: 'Aluno não encontrado',
                    code: 'STUDENT_NOT_FOUND'
                });
            }

            const serialize = (person: { id: string; name: string; cpf: string; birthDate: Date | null; }) => ({
                id: person.id,
                name: person.name,
                cpf: person.cpf,
                birthDate: person.birthDate ? person.birthDate.toISOString().slice(0, 10) : null
            });

            res.json({
                student: serialize(entry.student),
                responsible: entry.responsible ? serialize(entry.responsible) : null
            });
        } catch (err) {
            next(err);
        }
    });

    return r;
}
