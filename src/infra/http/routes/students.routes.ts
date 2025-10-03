import { Router } from 'express';
import { ListStudents } from '../../../app/use-cases/list-students';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';

export function studentsRouter(deps: { listStudents: ListStudents; }) {
    const r = Router();

    const canListStudents = requirePersona(UserPersonaEnum.ADMIN, UserPersonaEnum.SCHOOL);

    r.get('/', canListStudents, async (req, res, next) => {
        try {
            const cpf = typeof req.query.cpf === 'string' ? req.query.cpf : undefined;
            const students = await deps.listStudents.exec({ cpf });
            res.json({ students });
        } catch (err) {
            next(err);
        }
    });

    return r;
}
