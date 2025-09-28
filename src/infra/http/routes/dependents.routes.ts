import { Router } from 'express';
import { z } from 'zod';
import { AddDependent } from '../../../app/use-cases/add-dependent';
import { AuthenticatedRequest } from '../middlewares/auth';

export function dependentsRouter(deps: { addDependent: AddDependent; }) {
    const r = Router();

    r.post('/', async (req, res, next) => {
        try {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) throw new Error('Unauthorized');

            const schema = z.object({
                fullName: z.string().min(3),
                birthDate: z.string().datetime().optional(),
                relationship: z.string().min(1).optional()
            });
            const data = schema.parse(req.body);
            const dependent = await deps.addDependent.exec({
                ownerUserId: authReq.user.sub,
                fullName: data.fullName,
                birthDate: data.birthDate ?? null,
                relationship: data.relationship ?? null
            });
            res.status(201).json(dependent);
        } catch (err) {
            next(err);
        }
    });

    return r;
}
