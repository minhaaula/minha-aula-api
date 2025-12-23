import { Router } from 'express';
import { z } from 'zod';
import { AddDependent } from '../../../app/use-cases/add-dependent';
import { ListMyDependents } from '../../../app/use-cases/list-my-dependents';
import { DeleteDependent } from '../../../app/use-cases/delete-dependent';
import { UpdateDependent } from '../../../app/use-cases/update-dependent';
import { AuthenticatedRequest } from '../middlewares/auth';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { asyncHandler } from '../utils/async-handler';

export function dependentsRouter(deps: { 
    addDependent: AddDependent;
    listMyDependents?: ListMyDependents;
    deleteDependent?: DeleteDependent;
    updateDependent?: UpdateDependent;
}) {
    const r = Router();

    const requireStudentPersona = requirePersona(UserPersonaEnum.STUDENT);

    r.post('/', requireStudentPersona, asyncHandler(async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.user?.sub) {
            return res.status(401).json({ 
                error: 'Não autorizado',
                code: 'UNAUTHORIZED'
            });
        }

        const schema = z.object({
            fullName: z.string().trim().min(3, 'Nome deve ter pelo menos 3 caracteres'),
            cpf: z.string().trim().min(11).max(14).optional().nullable(),
            birthDate: z.string().trim().optional().nullable(),
            relationship: z.string().trim().optional().nullable()
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
    }));

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

    if (deps.updateDependent) {
        r.put('/:id', requireStudentPersona, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const dependentId = req.params.id?.trim();
            if (!dependentId) {
                return res.status(400).json({ 
                    error: 'ID do dependente é obrigatório',
                    code: 'INVALID_IDENTIFIERS'
                });
            }

            const schema = z.object({
                fullName: z.string().min(3).optional(),
                birthDate: z.string().trim().optional().nullable(),
                relationship: z.string().min(1).optional().nullable()
            });
            const data = schema.parse(req.body);

            const updated = await deps.updateDependent!.exec({
                ownerUserId: authReq.user.sub,
                dependentId,
                fullName: data.fullName,
                birthDate: data.birthDate ?? undefined,
                relationship: data.relationship ?? undefined
            });

            res.json(updated);
        }));
    }

    if (deps.deleteDependent) {
        r.delete('/:id', requireStudentPersona, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const dependentId = req.params.id?.trim();
            if (!dependentId) {
                return res.status(400).json({ 
                    error: 'ID do dependente é obrigatório',
                    code: 'INVALID_IDENTIFIERS'
                });
            }

            await deps.deleteDependent!.exec({
                ownerUserId: authReq.user.sub,
                dependentId
            });

            res.status(204).send();
        }));
    }

    return r;
}
