import { Router } from 'express';
import { z } from 'zod';
import { AddDependent } from '../../../app/use-cases/add-dependent';
import { ListMyDependents } from '../../../app/use-cases/list-my-dependents';
import { AuthenticatedRequest } from '../middlewares/auth';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { asyncHandler } from '../utils/async-handler';

export function dependentsRouter(deps: { 
    addDependent: AddDependent;
    listMyDependents?: ListMyDependents;
}) {
    const r = Router();

    const requireStudentPersona = requirePersona(UserPersonaEnum.STUDENT);

    r.post('/', requireStudentPersona, async (req, res, next) => {
        try {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) throw new Error('Unauthorized');

            const schema = z.object({
                fullName: z.string().min(3),
                cpf: z.string().trim().min(11).max(14).optional(),
                birthDate: z.string().trim().min(1).optional(),
                relationship: z.string().min(1).optional()
            });
            const data = schema.parse(req.body);
            const dependent = await deps.addDependent.exec({
                ownerUserId: authReq.user.sub,
                fullName: data.fullName,
                cpf: data.cpf ?? null,
                birthDate: data.birthDate ?? null,
                relationship: data.relationship ?? null
            });
            res.status(201).json(dependent);
        } catch (err) {
            next(err);
        }
    });

    if (deps.listMyDependents) {
        r.get('/', requireStudentPersona, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const result = await deps.listMyDependents!.exec({ userId: authReq.user.sub });
            res.json(result);
        }));
    }

    return r;
}
