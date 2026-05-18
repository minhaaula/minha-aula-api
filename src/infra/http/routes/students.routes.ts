import { Router } from 'express';
import { z } from 'zod';
import { ListStudents } from '../../../app/use-cases/list-students';
import { GetStudentDirectoryEntry } from '../../../app/use-cases/get-student-directory-entry';
import { ListMyCourses } from '../../../app/use-cases/list-my-courses';
import { ListAllCourses } from '../../../app/use-cases/list-all-courses';
import { ListStudentPayments } from '../../../app/use-cases/list-student-payments';
import { GetStudentPaymentDetails } from '../../../app/use-cases/get-student-payment-details';
import { GetMyProfile } from '../../../app/use-cases/get-my-profile';
import { ListMyEnrollmentRequests } from '../../../app/use-cases/list-my-enrollment-requests';
import { UpdateStudentProfile } from '../../../app/use-cases/update-student-profile';
import { DeactivateStudentAccount } from '../../../app/use-cases/deactivate-student-account';
import { ListSchoolCourses } from '../../../app/use-cases/list-school-courses';
import { ListSchoolReviews } from '../../../app/use-cases/list-school-reviews';
import { CreateSchoolReview } from '../../../app/use-cases/create-school-review';
import { ApproveEnrollmentRequest } from '../../../app/use-cases/approve-enrollment-request';
import { RejectEnrollmentRequest } from '../../../app/use-cases/reject-enrollment-request';
import { GetSchoolPublicDetails } from '../../../app/use-cases/get-school-public-details';
import { GenerateTuitionPix } from '../../../app/use-cases/generate-tuition-pix';
import { ListStudentNotifications } from '../../../app/use-cases/list-student-notifications';
import { ReadAllNotifications } from '../../../app/use-cases/read-all-notifications';
import { ReadStudentNotification } from '../../../app/use-cases/read-student-notification';
import type { RegisterPushToken } from '../../../app/use-cases/register-push-token';
import type { UnregisterPushToken } from '../../../app/use-cases/unregister-push-token';
import type { ListEnrollmentTimeline } from '../../../app/use-cases/list-enrollment-timeline';
import { parseEnrollmentTimelineQuery } from '../../../app/use-cases/list-enrollment-timeline';
import { buildStudentProfilePhotoRoutes } from './students/profile-photo.routes';
import type { UploadStudentProfilePhoto } from '../../../app/use-cases/upload-student-profile-photo';
import type { RemoveStudentProfilePhoto } from '../../../app/use-cases/remove-student-profile-photo';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AuthenticatedRequest } from '../middlewares/auth';
import { asyncHandler } from '../utils/async-handler';
import { updateStudentProfileSchema, deactivateStudentAccountSchema } from '../validators/student-schemas';

export function studentsRouter(deps: { 
    listStudents: ListStudents; 
    getStudentDirectoryEntry: GetStudentDirectoryEntry;
    listMyCourses?: ListMyCourses;
    listAllCourses?: ListAllCourses;
    listStudentPayments?: ListStudentPayments;
    getStudentPaymentDetails?: GetStudentPaymentDetails;
    getMyProfile?: GetMyProfile;
    listMyEnrollmentRequests?: ListMyEnrollmentRequests;
    updateStudentProfile?: UpdateStudentProfile;
    deactivateStudentAccount?: DeactivateStudentAccount;
    listSchoolCourses?: ListSchoolCourses;
    listSchoolReviews?: ListSchoolReviews;
    createSchoolReview?: CreateSchoolReview;
    approveEnrollmentRequest?: ApproveEnrollmentRequest;
    rejectEnrollmentRequest?: RejectEnrollmentRequest;
    getSchoolPublicDetails?: GetSchoolPublicDetails;
    generateTuitionPix?: GenerateTuitionPix;
    listStudentNotifications?: ListStudentNotifications;
    readAllNotifications?: ReadAllNotifications;
    readStudentNotification?: ReadStudentNotification;
    registerPushToken?: RegisterPushToken;
    unregisterPushToken?: UnregisterPushToken;
    listEnrollmentTimeline?: ListEnrollmentTimeline;
    uploadStudentProfilePhoto?: UploadStudentProfilePhoto;
    removeStudentProfilePhoto?: RemoveStudentProfilePhoto;
}) {
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

            try {
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
            } catch (execErr) {
                if (execErr instanceof Error && execErr.message === 'Invalid CPF') {
                    return res.status(400).json({ 
                        error: 'CPF inválido. Deve conter 11 dígitos',
                        code: 'INVALID_CPF'
                    });
                }
                throw execErr;
            }
        } catch (err) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({ 
                    error: 'Parâmetro CPF inválido',
                    code: 'VALIDATION_ERROR',
                    details: err.errors
                });
            }
            next(err);
        }
    });

    const requireStudent = requirePersona(UserPersonaEnum.STUDENT);

    if (deps.uploadStudentProfilePhoto && deps.removeStudentProfilePhoto) {
        r.use(
            '/me/profile-photo',
            requireStudent,
            buildStudentProfilePhotoRoutes({
                uploadStudentProfilePhoto: deps.uploadStudentProfilePhoto,
                removeStudentProfilePhoto: deps.removeStudentProfilePhoto
            })
        );
    }

    if (deps.getMyProfile) {
        r.get('/me', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const profile = await deps.getMyProfile!.exec({ userId: authReq.user.sub });
            if (!profile) {
                return res.status(404).json({ 
                    error: 'Estudante não encontrado',
                    code: 'STUDENT_NOT_FOUND'
                });
            }

            res.json(profile);
        }));
    }

    if (deps.updateStudentProfile) {
        r.put('/me', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const data = updateStudentProfileSchema.parse(req.body ?? {});
            const result = await deps.updateStudentProfile!.exec({
                userId: authReq.user.sub,
                fullName: data.fullName,
                email: data.email,
                phone: data.phone,
                address: data.address
            });

            res.json(result);
        }));
    }

    if (deps.deactivateStudentAccount) {
        const deactivateStudentAccount = deps.deactivateStudentAccount;
        r.post('/me/account/deactivate', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
            }

            const dto = deactivateStudentAccountSchema.parse(req.body ?? {});
            const result = await deactivateStudentAccount.exec({
                userId: authReq.user.sub,
                motivo: dto.motivo,
                descricao: dto.descricao ?? ''
            });
            res.json(result);
        }));
    }

    if (deps.listMyCourses) {
        r.get('/courses', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const result = await deps.listMyCourses!.exec({ userId: authReq.user.sub });
            res.json(result);
        }));
    }

    if (deps.listAllCourses) {
        const allCoursesQuerySchema = z.object({
            name: z.string().trim().min(1).optional(),
            categoryId: z.string().trim().min(1).optional(),
            subcategoryId: z.string().trim().min(1).optional(),
            city: z.string().trim().min(1).optional()
        });

        r.get('/courses/all', asyncHandler(async (req, res) => {
            const query = allCoursesQuerySchema.parse({
                name: typeof req.query.name === 'string' ? req.query.name : undefined,
                categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
                subcategoryId: typeof req.query.subcategoryId === 'string' ? req.query.subcategoryId : undefined,
                city: typeof req.query.city === 'string' ? req.query.city : undefined
            });

            const result = await deps.listAllCourses!.exec(query);
            res.json(result);
        }));
    }

    if (deps.listStudentPayments) {
        const paymentsQuerySchema = z.object({
            status: z.enum(['pendente', 'atrasado', 'pago']).optional(),
            isPaid: z.union([z.boolean(), z.string().transform((val) => val === 'true')]).optional(),
            year: z.coerce.number().int().min(2000).max(3000).optional()
        });

        r.get('/payments', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            let isPaid: boolean | undefined = undefined;
            if (req.query.isPaid !== undefined) {
                const isPaidValue = req.query.isPaid;
                if (typeof isPaidValue === 'string') {
                    isPaid = isPaidValue.toLowerCase() === 'true';
                } else if (typeof isPaidValue === 'boolean') {
                    isPaid = isPaidValue;
                }
            }

            const query = paymentsQuerySchema.parse({
                status: typeof req.query.status === 'string' ? req.query.status : undefined,
                isPaid,
                year: typeof req.query.year === 'string' || typeof req.query.year === 'number'
                    ? req.query.year
                    : undefined
            });

            const result = await deps.listStudentPayments!.exec({
                userId: authReq.user.sub,
                status: query.status,
                isPaid: query.isPaid,
                year: query.year
            });
            res.json(result);
        }));
    }

    if (deps.getStudentPaymentDetails) {
        r.get('/payments/:paymentId', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const paramsSchema = z.object({ 
                paymentId: z.string().uuid('ID do pagamento inválido')
            });
            const { paymentId } = paramsSchema.parse(req.params);

            const details = await deps.getStudentPaymentDetails!.exec({
                paymentId,
                userId: authReq.user.sub
            });

            res.json(details);
        }));
    }

    if (deps.listMyEnrollmentRequests) {
        r.get('/enrollment-requests', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const result = await deps.listMyEnrollmentRequests!.exec({
                userId: authReq.user.sub
            });
            res.json(result);
        }));
    }

    if (deps.approveEnrollmentRequest) {
        r.post('/enrollment-requests/:requestId/accept', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const paramsSchema = z.object({ requestId: z.string().uuid() });
            const { requestId } = paramsSchema.parse(req.params);
            
            const bodySchema = z.object({ notes: z.string().max(255).optional() });
            const { notes } = bodySchema.parse(req.body ?? {});

            const result = await deps.approveEnrollmentRequest!.exec({
                requestId,
                approverUserId: authReq.user.sub,
                notes: notes ?? null
            });

            res.json(result);
        }));
    }

    if (deps.rejectEnrollmentRequest) {
        r.post('/enrollment-requests/:requestId/reject', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const paramsSchema = z.object({ requestId: z.string().uuid() });
            const { requestId } = paramsSchema.parse(req.params);
            
            const bodySchema = z.object({ notes: z.string().max(255).optional() });
            const { notes } = bodySchema.parse(req.body ?? {});

            const result = await deps.rejectEnrollmentRequest!.exec({
                requestId,
                rejectorUserId: authReq.user.sub,
                notes: notes ?? null
            });

            res.json(result);
        }));
    }

    if (deps.getSchoolPublicDetails) {
        r.get('/schools/:schoolId', asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                schoolId: z.string().uuid()
            });

            const { schoolId } = paramsSchema.parse(req.params);
            
            // Obter userId se estiver autenticado (opcional)
            const authReq = req as AuthenticatedRequest;
            const userId = authReq.user?.sub || undefined;

            const school = await deps.getSchoolPublicDetails!.exec({ 
                schoolId,
                userId 
            });
            if (!school) {
                return res.status(404).json({ 
                    error: 'Escola não encontrada',
                    code: 'SCHOOL_NOT_FOUND'
                });
            }

            res.json(school);
        }));
    }

    if (deps.listSchoolCourses) {
        r.get('/schools/:schoolId/courses', asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                schoolId: z.string().uuid()
            });

            const { schoolId } = paramsSchema.parse(req.params);

            const courses = await deps.listSchoolCourses!.exec({ schoolId });
            res.json({ courses });
        }));
    }

    if (deps.listSchoolReviews) {
        r.get('/schools/:schoolId/reviews', asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                schoolId: z.string().uuid()
            });

            const querySchema = z.object({
                limit: z.coerce.number().int().positive().max(100).optional(),
                offset: z.coerce.number().int().min(0).optional()
            });

            const { schoolId } = paramsSchema.parse(req.params);
            const query = querySchema.parse({
                limit: typeof req.query.limit === 'string' ? req.query.limit : undefined,
                offset: typeof req.query.offset === 'string' ? req.query.offset : undefined
            });

            const result = await deps.listSchoolReviews!.exec({
                schoolId,
                limit: query.limit,
                offset: query.offset
            });
            res.json(result);
        }));
    }

    if (deps.createSchoolReview) {
        r.post('/schools/:schoolId/reviews', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const paramsSchema = z.object({
                schoolId: z.string().uuid()
            });

            const bodySchema = z.object({
                rating: z.number().int().min(1).max(5),
                description: z.string().max(1000).optional().nullable()
            });

            const { schoolId } = paramsSchema.parse(req.params);
            const body = bodySchema.parse(req.body ?? {});

            const result = await deps.createSchoolReview!.exec({
                schoolId,
                userId: authReq.user.sub,
                rating: body.rating,
                description: body.description ?? null
            });

            res.status(201).json(result);
        }));
    }

    if (deps.generateTuitionPix) {
        r.post('/charges/:chargeId/payments/pix', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const paramsSchema = z.object({
                chargeId: z.string().uuid()
            });
            const { chargeId } = paramsSchema.parse(req.params);

            const result = await deps.generateTuitionPix!.exec({
                chargeId,
                requester: {
                    id: authReq.user.sub,
                    persona: UserPersonaEnum.STUDENT
                }
            });

            res.json(result);
        }));
    }

    if (deps.listStudentNotifications) {
        r.get('/notifications', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const querySchema = z.object({
                limit: z.coerce.number().int().positive().max(100).optional(),
                offset: z.coerce.number().int().min(0).optional()
            });

            const query = querySchema.parse({
                limit: req.query.limit,
                offset: req.query.offset
            });

            const result = await deps.listStudentNotifications!.exec({
                userId: authReq.user.sub,
                limit: query.limit,
                offset: query.offset
            });

            res.json(result);
        }));
    }

    if (deps.readAllNotifications) {
        r.put('/notifications/read-all', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const result = await deps.readAllNotifications!.exec({
                userId: authReq.user.sub
            });

            res.json(result);
        }));
    }

    if (deps.readStudentNotification) {
        r.put('/notifications/:notificationId/read', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const paramsSchema = z.object({ notificationId: z.string().uuid() });
            const { notificationId } = paramsSchema.parse(req.params);

            const result = await deps.readStudentNotification!.exec({
                userId: authReq.user.sub,
                notificationId
            });

            res.json(result);
        }));
    }

    if (deps.registerPushToken) {
        r.post('/push-tokens', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
            }

            const bodySchema = z.object({
                token: z.string().min(10),
                platform: z.enum(['ANDROID', 'IOS', 'WEB', 'UNKNOWN']).optional()
            });
            const data = bodySchema.parse(req.body ?? {});
            const result = await deps.registerPushToken!.exec({
                userId: authReq.user.sub,
                token: data.token,
                platform: data.platform ?? 'UNKNOWN'
            });
            res.status(201).json(result);
        }));
    }

    if (deps.unregisterPushToken) {
        r.delete('/push-tokens', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
            }

            const bodySchema = z.object({ token: z.string().min(10) });
            const data = bodySchema.parse(req.body ?? {});
            const result = await deps.unregisterPushToken!.exec({
                userId: authReq.user.sub,
                token: data.token
            });
            res.json(result);
        }));
    }

    if (deps.listEnrollmentTimeline) {
        r.get('/enrollments/:enrollmentId/timeline', requireStudent, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
            }
            const params = z.object({ enrollmentId: z.string().uuid() }).parse(req.params);
            const pagination = parseEnrollmentTimelineQuery(req.query);
            const result = await deps.listEnrollmentTimeline!.execForStudent({
                ownerUserId: authReq.user.sub,
                enrollmentId: params.enrollmentId,
                ...pagination
            });
            if (!result) {
                return res.status(404).json({
                    error: 'Matrícula não encontrada para este usuário',
                    code: 'NOT_FOUND'
                });
            }
            res.json(result);
        }));
    }

    return r;
}
