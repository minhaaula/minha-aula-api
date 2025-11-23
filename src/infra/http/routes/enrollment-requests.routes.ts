import { Router } from 'express';
import { z } from 'zod';
import { CreateEnrollmentRequest } from '../../../app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from '../../../app/use-cases/approve-enrollment-request';
import { ListEnrollmentRequests } from '../../../app/use-cases/list-enrollment-requests';
import { GetEnrollmentRequest } from '../../../app/use-cases/get-enrollment-request';
import { IssueEnrollmentFeeBoleto } from '../../../app/use-cases/issue-enrollment-fee-boleto';
import { AuthenticatedRequest } from '../middlewares/auth';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import type { EnrollmentRequest } from '../../../domain/entities/enrollment-request';
import type { EnrollmentRequestWithDetails } from '../../../ports/repositories/enrollment-request.repo';

export function enrollmentRequestsRouter(deps: {
    createEnrollmentRequest: CreateEnrollmentRequest;
    approveEnrollmentRequest: ApproveEnrollmentRequest;
    listEnrollmentRequests: ListEnrollmentRequests;
    getEnrollmentRequest: GetEnrollmentRequest;
    issueEnrollmentFeeBoleto: IssueEnrollmentFeeBoleto;
}) {
    const r = Router();

    const canManageRequests = requirePersona(UserPersonaEnum.ADMIN, UserPersonaEnum.SCHOOL);
    const canIssueEnrollmentFeeBoleto = requirePersona(UserPersonaEnum.ADMIN, UserPersonaEnum.SCHOOL, UserPersonaEnum.STUDENT);

    type SerializableRequest = EnrollmentRequest | EnrollmentRequestWithDetails;

    const serializeEnrollmentRequest = (item: SerializableRequest) => {
        const request = 'request' in item ? item.request : item;
        return {
            id: request.id,
            status: request.status,
            schoolId: request.schoolId,
            courseClassId: request.courseClassId,
            requestedForUserId: request.requestedForUserId,
            requestedForDependentId: request.requestedForDependentId,
            decidedAt: request.decidedAt,
            decidedByUserId: request.decidedByUserId,
            notes: request.notes,
            discont: request.discountCents !== null ? request.discountCents / 100 : null,
            enrollmentFeeAmount: request.enrollmentFeeCents !== null ? request.enrollmentFeeCents / 100 : null,
            enrollmentFeeDueDate: request.enrollmentFeeDueDate
                ? request.enrollmentFeeDueDate.toISOString().slice(0, 10)
                : null,
            firstMonthlyPaymentDate: request.firstMonthlyPaymentDate.toISOString().slice(0, 10),
            enrollmentId: request.enrollmentId,
            createdAt: request.createdAt,
            courseLabel: 'request' in item ? item.courseLabel : null,
            courseClassLabel: 'request' in item ? item.courseClassLabel : null,
            studentName: 'request' in item ? item.studentName : null,
            dependentName: 'request' in item ? item.dependentName : null
        };
    };

    r.get('/schools', canManageRequests, async (req, res, next) => {
        try {
            const authReq = req as AuthenticatedRequest;
            const querySchema = z.object({
                schoolId: z.string().uuid().optional(),
                classId: z.string().uuid().optional(),
                courseId: z.string().uuid().optional(),
                studentDocument: z.string().trim().min(1).optional(),
                limit: z.coerce.number().int().positive().max(100).optional(),
                offset: z.coerce.number().int().min(0).optional()
            });

            const query = querySchema.parse({
                schoolId: typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined,
                classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
                courseId: typeof req.query.courseId === 'string' ? req.query.courseId : undefined,
                studentDocument: typeof req.query.studentDocument === 'string' ? req.query.studentDocument : undefined,
                limit: typeof req.query.limit === 'string' ? req.query.limit : undefined,
                offset: typeof req.query.offset === 'string' ? req.query.offset : undefined
            });

            const persona = authReq.user?.persona;
            let schoolId = query.schoolId;

            if (persona === UserPersonaEnum.SCHOOL) {
                const contextSchoolId = authReq.user?.schoolId;
                if (!contextSchoolId) {
                    return res.status(403).json({ 
                        error: 'Contexto de escola não encontrado para o usuário',
                        code: 'SCHOOL_CONTEXT_NOT_FOUND'
                    });
                }
                if (schoolId && schoolId !== contextSchoolId) {
                    return res.status(403).json({ 
                        error: 'Não é possível acessar solicitações de matrícula de outra escola',
                        code: 'FORBIDDEN'
                    });
                }
                schoolId = contextSchoolId;
            }

            if (!schoolId) {
                return res.status(400).json({ 
                    error: 'schoolId é obrigatório',
                    code: 'REQUIRED_FIELD'
                });
            }

            const requests = await deps.listEnrollmentRequests.exec({
                schoolId,
                courseClassId: query.classId,
                courseId: query.courseId,
                status: 'PENDING',
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
                return res.status(404).json({ 
                    error: 'Solicitação de matrícula não encontrada',
                    code: 'ENROLLMENT_REQUEST_NOT_FOUND'
                });
            }
            res.json(serializeEnrollmentRequest(request));
        } catch (err) {
            next(err);
        }
    });

    r.post('/schools/classes/:classId/requests', canManageRequests, async (req, res, next) => {
        try {
            const paramsSchema = z.object({
                classId: z.string().uuid()
            });
            const { classId } = paramsSchema.parse(req.params);
            const bodySchema = z.object({
                requestedForUserId: z.string().uuid(),
                requestedForDependentId: z.string().uuid().optional(),
                notes: z.string().max(255).optional(),
                discont: z.coerce.number().min(0).optional(),
                schoolId: z.string().uuid().optional(),
                enrollmentFeeAmount: z.coerce.number().min(0).optional(),
                enrollmentFeeDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
                firstMonthlyPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
            });
            const data = bodySchema.parse(req.body);
            const authReq = req as AuthenticatedRequest;
            const persona = authReq.user?.persona;

            let schoolId = data.schoolId;
            if (persona === UserPersonaEnum.SCHOOL) {
                const contextSchoolId = authReq.user?.schoolId;
                if (!contextSchoolId) {
                    return res.status(403).json({ 
                        error: 'Contexto de escola não encontrado para o usuário',
                        code: 'SCHOOL_CONTEXT_NOT_FOUND'
                    });
                }
                schoolId = contextSchoolId;
            }

            if (!schoolId) {
                return res.status(400).json({ 
                    error: 'schoolId é obrigatório',
                    code: 'REQUIRED_FIELD'
                });
            }

            const request = await deps.createEnrollmentRequest.exec({
                schoolId,
                courseClassId: classId,
                requestedForUserId: data.requestedForUserId,
                requestedForDependentId: data.requestedForDependentId ?? null,
                notes: data.notes ?? null,
                discount: data.discont ?? null,
                enrollmentFeeAmount: data.enrollmentFeeAmount ?? null,
                enrollmentFeeDueDate: data.enrollmentFeeDueDate ?? null,
                firstMonthlyPaymentDate: data.firstMonthlyPaymentDate
            });
            res.status(201).json(serializeEnrollmentRequest(request));
        } catch (err) {
            next(err);
        }
    });

    r.post('/:requestId/approve', async (req, res, next) => {
        try {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                throw new Error('Unauthorized');
            }
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

    r.post('/charges/:chargeId/boleto', canIssueEnrollmentFeeBoleto, async (req, res, next) => {
        try {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                throw new Error('Unauthorized');
            }

            const paramsSchema = z.object({ chargeId: z.string().uuid() });
            const { chargeId } = paramsSchema.parse(req.params);

            const result = await deps.issueEnrollmentFeeBoleto.exec({
                chargeId,
                requester: {
                    id: authReq.user.sub,
                    persona: authReq.user.persona as UserPersonaEnum,
                    schoolId: typeof authReq.user.schoolId === 'string' ? authReq.user.schoolId : null
                }
            });

            res.json({
                chargeId: result.chargeId,
                paymentProviderRef: result.paymentProviderRef,
                boletoUrl: result.boletoUrl,
                digitableLine: result.digitableLine,
                barcode: result.barcode,
                dueDate: result.dueDate.toISOString().slice(0, 10),
                status: result.status
            });
        } catch (err) {
            if (err instanceof Error) {
                if (err.message === 'User not allowed to issue boleto for this charge') {
                    return res.status(403).json({ error: err.message });
                }
                if (err.message === 'Charge not found' || err.message === 'Charge type does not allow boleto issuance') {
                    return res.status(404).json({ error: err.message });
                }
                if (err.message === 'Charge is not eligible for boleto issuance') {
                    return res.status(400).json({ error: err.message });
                }
            }
            next(err);
        }
    });

    return r;
}
