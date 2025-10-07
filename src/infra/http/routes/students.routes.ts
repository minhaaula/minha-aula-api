import { Router } from 'express';
import { ListStudents } from '../../../app/use-cases/list-students';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AuthenticatedRequest } from '../middlewares/auth';

export function studentsRouter(deps: { listStudents: ListStudents; }) {
    const r = Router();

    const canListStudents = requirePersona(UserPersonaEnum.ADMIN, UserPersonaEnum.SCHOOL);

    r.get('/', canListStudents, async (req, res, next) => {
        try {
            const cpf = typeof req.query.cpf === 'string' ? req.query.cpf : undefined;
            const authReq = req as AuthenticatedRequest;
            const persona = authReq.user?.persona;
            const schoolId = persona === UserPersonaEnum.SCHOOL && typeof authReq.user?.schoolId === 'string'
                ? authReq.user.schoolId
                : undefined;

            if (persona === UserPersonaEnum.SCHOOL && !schoolId) {
                return res.status(403).json({ error: 'School context not found for user' });
            }

            const students = await deps.listStudents.exec({ cpf, schoolId });
            res.json({ students });
        } catch (err) {
            next(err);
        }
    });

    return r;
}
