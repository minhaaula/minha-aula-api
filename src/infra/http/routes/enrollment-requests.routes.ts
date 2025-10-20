import { Router } from 'express';
import { z } from 'zod';
import { CreateEnrollmentRequest } from '../../../app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from '../../../app/use-cases/approve-enrollment-request';
import { ListEnrollmentRequests } from '../../../app/use-cases/list-enrollment-requests';
import { GetEnrollmentRequest } from '../../../app/use-cases/get-enrollment-request';
import { AuthenticatedRequest } from '../middlewares/auth';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { EnrollmentRequest } from '../../../domain/entities/enrollment-request';

export function enrollmentRequestsRouter(deps: {
    createEnrollmentRequest: CreateEnrollmentRequest;
    approveEnrollmentRequest: ApproveEnrollmentRequest;
    listEnrollmentRequests: ListEnrollmentRequests;
    getEnrollmentRequest: GetEnrollmentRequest;
}) {
    const r = Router();

    const canManageRequests = requirePersona(UserPersonaEnum.ADMIN, UserPersonaEnum.SCHOOL);

    const serializeEnrollmentRequest = (request: EnrollmentRequest) => ({
        id: request.id,
        status: request.status,
        schoolId: request.schoolId,
        courseClassId: request.courseClassId,
        requestedForUserId: request.requestedForUserId,
        requestedForDependentId: request.requestedForDependentId,
        decidedAt: request.decidedAt,
        decidedByUserId: request.decidedByUserId,
        notes: request.notes,
        enrollmentId: request.enrollmentId,
        createdAt: request.createdAt
    });

    r.get('/schools', canManageRequests, async (req, res, next) => {
        try {
            const authReq = req as AuthenticatedRequest;
            const querySchema = z.object({
                schoolId: z.string().uuid().optional(),
                classId: z.string().uuid().optional(),
                courseId: z.string().uuid().optional(),
                studentDocument: z.string().trim().min(1).optional(),
                status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
                limit: z.coerce.number().int().positive().max(100).optional(),
                offset: z.coerce.number().int().min(0).optional()
            });

            const query = querySchema.parse({
                schoolId: typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined,
                classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
                courseId: typeof req.query.courseId === 'string' ? req.query.courseId : undefined,
                studentDocument: typeof req.query.studentDocument === 'string' ? req.query.studentDocument : undefined,
                status: typeof req.query.status === 'string' ? req.query.status : undefined,
                limit: typeof req.query.limit === 'string' ? req.query.limit : undefined,
                offset: typeof req.query.offset === 'string' ? req.query.offset : undefined
            });

            const persona = authReq.user?.persona;
            let schoolId = query.schoolId;

            if (persona === UserPersonaEnum.SCHOOL) {
                const contextSchoolId = authReq.user?.schoolId;
                if (!contextSchoolId) {
                    return res.status(403).json({ error: 'School context not found for user' });
                }
                if (schoolId && schoolId !== contextSchoolId) {
                    return res.status(403).json({ error: 'Cannot access enrollment requests for another school' });
                }
                schoolId = contextSchoolId;
            }

            if (!schoolId) {
                return res.status(400).json({ error: 'schoolId is required' });
            }

            const requests = await deps.listEnrollmentRequests.exec({
                schoolId,
                courseClassId: query.classId,
                courseId: query.courseId,
                status: query.status,
                studentDocument: query.studentDocument,
                limit: query.limit,
                offset: query.offset
            });

            res.json({ requests: requests.map(serializeEnrollmentRequest) });
        } catch (err) {
            next(err);
        }
    });

    r.get('/schools/:schoolId/classes/:classId/requests', canManageRequests, async (req, res, next) => {
        try {
            const paramsSchema = z.object({
                schoolId: z.string().uuid(),
                classId: z.string().uuid()
            });
            const querySchema = z.object({
                status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
                requestedForUserId: z.string().uuid().optional(),
                requestedForDependentId: z.union([z.string().uuid(), z.literal('null'), z.literal('')]).optional(),
                limit: z.coerce.number().int().positive().max(100).optional(),
                offset: z.coerce.number().int().min(0).optional()
            });
            const { schoolId, classId } = paramsSchema.parse(req.params);
            const query = querySchema.parse(req.query);

            const requests = await deps.listEnrollmentRequests.exec({
                schoolId,
                courseClassId: classId,
                status: query.status,
                requestedForUserId: query.requestedForUserId,
                requestedForDependentId: query.requestedForDependentId === 'null' || query.requestedForDependentId === ''
                    ? null
                    : query.requestedForDependentId,
                limit: query.limit,
                offset: query.offset
            });

            res.json({ requests: requests.map(serializeEnrollmentRequest) });
        } catch (err) {
            next(err);
        }
    });

    r.get('/:requestId', canManageRequests, async (req, res, next) => {
        try {
            const paramsSchema = z.object({ requestId: z.string().uuid() });
            const { requestId } = paramsSchema.parse(req.params);
            const request = await deps.getEnrollmentRequest.exec({ requestId });
            if (!request) {
                return res.status(404).json({ error: 'Enrollment request not found' });
            }
            res.json(serializeEnrollmentRequest(request));
        } catch (err) {
            next(err);
        }
    });

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
            res.status(201).json(serializeEnrollmentRequest(request));
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
