import { Router } from 'express';
import { z } from 'zod';
import { CreateEnrollmentRequest } from '../../../app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from '../../../app/use-cases/approve-enrollment-request';
import { AuthenticatedRequest } from '../middlewares/auth';

export function enrollmentRequestsRouter(deps: {
    createEnrollmentRequest: CreateEnrollmentRequest;
    approveEnrollmentRequest: ApproveEnrollmentRequest;
}) {
    const r = Router();

    r.post('/schools/:schoolId/classes/:classId/requests', async (req, res, next) => {
        try {
            const paramsSchema = z.object({
                schoolId: z.string().uuid(),
                classId: z.string().uuid()
            });
            const { schoolId, classId } = paramsSchema.parse(req.params);
            const bodySchema = z.object({
                requestedForUserId: z.string().uuid(),
                requestedForDependentId: z.string().uuid().optional(),
                notes: z.string().max(255).optional()
            });
            const data = bodySchema.parse(req.body);
            const request = await deps.createEnrollmentRequest.exec({
                schoolId,
                courseClassId: classId,
                requestedForUserId: data.requestedForUserId,
                requestedForDependentId: data.requestedForDependentId ?? null,
                notes: data.notes ?? null
            });
            res.status(201).json(request);
        } catch (err) {
            next(err);
        }
    });

    r.post('/:requestId/approve', async (req, res, next) => {
        try {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) throw new Error('Unauthorized');
            const paramsSchema = z.object({ requestId: z.string().uuid() });
            const { requestId } = paramsSchema.parse(req.params);
            const bodySchema = z.object({ notes: z.string().max(255).optional() });
            const { notes } = bodySchema.parse(req.body ?? {});
            const result = await deps.approveEnrollmentRequest.exec({
                requestId,
                approverUserId: authReq.user.sub,
                notes: notes ?? null
            });
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    return r;
}
