import { Router, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { CreateSchool } from '../../../app/use-cases/create-school';
import { CreateCourse } from '../../../app/use-cases/create-course';
import { CreateCourseClass } from '../../../app/use-cases/create-course-class';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AuthenticatedRequest } from '../middlewares/auth';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { ScheduleClassSession } from '../../../app/use-cases/schedule-class-session';
import { ListClassSessions } from '../../../app/use-cases/list-class-sessions';
import { CancelClassSession } from '../../../app/use-cases/cancel-class-session';
import { LoginSchool } from '../../../app/use-cases/login-school';
import {
    cnpjNumberSchema,
    cpfNumberSchema,
    phoneNumberSchema,
    zipCodeNumberSchema
} from '../validators/numeric-fields';

export function schoolsRouter(deps: {
    createSchool: CreateSchool;
    createCourse: CreateCourse;
    createCourseClass: CreateCourseClass;
    scheduleClassSession: ScheduleClassSession;
    listClassSessions: ListClassSessions;
    cancelClassSession: CancelClassSession;
    loginSchool?: LoginSchool;
    authMiddleware?: RequestHandler;
    schoolsRepo?: SchoolRepository;
}) {
    const r = Router();
    const requireAuth: RequestHandler = deps.authMiddleware ?? ((_req, _res, next) => next());
    const optionalAuth: RequestHandler = deps.authMiddleware
        ? (req, res, next) => {
            if (!req.headers.authorization) {
                return next();
            }
            deps.authMiddleware?.(req, res, next);
        }
        : (_req, _res, next) => next();
    const requireSchoolPersona = requirePersona(UserPersonaEnum.SCHOOL);

    const resolveRequestSchoolId = async (req: AuthenticatedRequest, res: Response): Promise<string | undefined> => {
        const payload = req.user;
        const schoolIdFromToken = typeof payload?.schoolId === 'string' ? payload.schoolId.trim() : '';
        if (schoolIdFromToken) return schoolIdFromToken;

        const repo = deps.schoolsRepo;
        if (repo) {
            const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
            if (email && repo.findByEmail) {
                const school = await repo.findByEmail(email);
                if (school) return school.id;
            }
            const userId = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
            if (userId) {
                const school = repo.findByOwnerUserId
                    ? await repo.findByOwnerUserId(userId)
                    : await repo.findById(userId);
                if (school) return school.id;
            }
        }

        console.warn('School context not resolved for user', {
            userId: payload?.sub ?? null,
            email: payload?.email ?? null,
            hasTokenSchoolId: Boolean(payload?.schoolId),
            resolvedFromToken: Boolean(schoolIdFromToken),
            repoAvailable: Boolean(repo)
        });
        res.status(403).json({ error: 'School context not found for user' });
        return undefined;
    };

    r.post('/login', async (req, res, next) => {
        try {
            if (!deps.loginSchool) {
                return res.status(501).json({ error: 'School login not configured' });
            }
            const schema = z.object({
                email: z.string().trim().email(),
                password: z.string().min(8)
            });
            const data = schema.parse(req.body);
            const result = await deps.loginSchool.exec({
                email: data.email,
                password: data.password
            });
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    r.post('/', optionalAuth, async (req, res, next) => {
        try {
            const addressSchema = z.object({
                street: z.string().trim().min(1),
                number: z.string().trim().min(1),
                complement: z.string().trim().min(1).optional().nullable(),
                district: z.string().trim().min(1).optional().nullable(),
                city: z.string().trim().min(1),
                state: z.string().trim().min(1),
                zipCode: zipCodeNumberSchema()
            });

            const schema = z.object({
                name: z.string().trim().min(3),
                email: z.string().trim().email(),
                phone: phoneNumberSchema(),
                cnpj: cnpjNumberSchema(),
                ownerName: z.string().trim().min(3),
                ownerCpf: cpfNumberSchema(),
                ownerEmail: z.string().trim().email(),
                ownerPassword: z.string().min(8),
                addresses: z.array(addressSchema).optional()
            });

            const data = schema.parse(req.body);
            const authReq = req as AuthenticatedRequest;
            const ownerUserId = authReq.user?.persona === UserPersonaEnum.SCHOOL ? authReq.user.sub : null;

            const school = await deps.createSchool.exec({
                name: data.name,
                email: data.email,
                phone: data.phone,
                cnpj: data.cnpj,
                addresses: data.addresses?.map((address) => ({
                    street: address.street,
                    number: address.number,
                    complement: address.complement ?? null,
                    district: address.district ?? null,
                    city: address.city,
                    state: address.state,
                    zipCode: address.zipCode
                })),
                ownerUserId,
                ownerName: data.ownerName,
                ownerCpf: data.ownerCpf,
                ownerEmail: data.ownerEmail,
                ownerPassword: data.ownerPassword
            });
            res.status(201).json(school);
        } catch (err) {
            next(err);
        }
    });

    r.post('/courses', requireAuth, requireSchoolPersona, async (req, res, next) => {
        try {
            const schoolId = await resolveRequestSchoolId(req as AuthenticatedRequest, res);
            if (!schoolId) return;
            const categorySchema = z.object({
                categoryId: z.string().trim().min(1),
                subcategoryIds: z.array(z.string().trim().min(1)).optional()
            });

            const bodySchema = z.object({
                name: z.string().min(3),
                description: z.string().min(1).optional(),
                categories: z.array(categorySchema).optional()
            });
            const data = bodySchema.parse(req.body);
            const course = await deps.createCourse.exec({
                schoolId,
                name: data.name,
                description: data.description ?? null,
                categories: data.categories?.map((category) => ({
                    categoryId: category.categoryId,
                    subcategoryIds: category.subcategoryIds ?? []
                }))
            });
            res.status(201).json(course);
        } catch (err) {
            next(err);
        }
    });

    r.post('/courses/:courseId/classes', requireAuth, requireSchoolPersona, async (req, res, next) => {
        try {
            const paramsSchema = z.object({
                courseId: z.string().uuid()
            });
            const { courseId } = paramsSchema.parse(req.params);
            const bodySchema = z.object({
                label: z.string().min(1),
                shift: z.string().min(1).optional(),
                capacity: z.number().int().positive().optional(),
                startsAt: z.string().datetime().optional(),
                endsAt: z.string().datetime().optional()
            }).superRefine((value, ctx) => {
                const { startsAt, endsAt } = value;
                if (!startsAt || !endsAt) return;

                const starts = new Date(startsAt);
                const ends = new Date(endsAt);

                let hasStartIssue = false;
                let hasEndIssue = false;

                if (Number.isNaN(starts.getTime())) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startsAt'], message: 'Invalid start date' });
                    hasStartIssue = true;
                }
                if (Number.isNaN(ends.getTime())) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'Invalid end date' });
                    hasEndIssue = true;
                }
                if (!hasStartIssue && !hasEndIssue && ends <= starts) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'End date must be after start date' });
                }
            });
            const data = bodySchema.parse(req.body);
            const startsAt = data.startsAt ? new Date(data.startsAt) : null;
            const endsAt = data.endsAt ? new Date(data.endsAt) : null;
            const schoolId = await resolveRequestSchoolId(req as AuthenticatedRequest, res);
            if (!schoolId) return;
            const courseClass = await deps.createCourseClass.exec({
                schoolId,
                courseId,
                label: data.label,
                shift: data.shift ?? null,
                capacity: data.capacity ?? null,
                startsAt,
                endsAt
            });
            res.status(201).json(courseClass);
        } catch (err) {
            next(err);
        }
    });

    r.post('/courses/:courseId/classes/:classId/sessions', requireAuth, requireSchoolPersona, async (req, res, next) => {
        try {
            const paramsSchema = z.object({
                courseId: z.string().uuid(),
                classId: z.string().uuid()
            });
            const { classId } = paramsSchema.parse(req.params);
            const bodySchema = z.object({
                startsAt: z.string().datetime(),
                endsAt: z.string().datetime(),
                location: z.string().trim().min(1).optional(),
                notes: z.string().trim().min(1).optional()
            });
            const data = bodySchema.parse(req.body);
            const schoolId = await resolveRequestSchoolId(req as AuthenticatedRequest, res);
            if (!schoolId) return;

            const startsAt = new Date(data.startsAt);
            const endsAt = new Date(data.endsAt);

            const session = await deps.scheduleClassSession.exec({
                schoolId,
                courseClassId: classId,
                startsAt,
                endsAt,
                location: data.location ?? null,
                notes: data.notes ?? null
            });
            res.status(201).json(session);
        } catch (err) {
            next(err);
        }
    });

    r.get('/courses/:courseId/classes/:classId/sessions', requireAuth, requireSchoolPersona, async (req, res, next) => {
        try {
            const paramsSchema = z.object({
                courseId: z.string().uuid(),
                classId: z.string().uuid()
            });
            const { classId } = paramsSchema.parse(req.params);
            const querySchema = z.object({
                from: z.string().datetime(),
                to: z.string().datetime()
            });
            const { from, to } = querySchema.parse(req.query);
            const schoolId = await resolveRequestSchoolId(req as AuthenticatedRequest, res);
            if (!schoolId) return;

            const sessions = await deps.listClassSessions.exec({
                schoolId,
                courseClassId: classId,
                from: new Date(from),
                to: new Date(to)
            });
            res.json({ sessions });
        } catch (err) {
            next(err);
        }
    });

    r.get('/sessions', requireAuth, requireSchoolPersona, async (req, res, next) => {
        try {
            const querySchema = z.object({
                from: z.string().datetime(),
                to: z.string().datetime(),
                courseClassId: z.string().uuid().optional()
            });
            const { from, to, courseClassId } = querySchema.parse(req.query);
            const schoolId = await resolveRequestSchoolId(req as AuthenticatedRequest, res);
            if (!schoolId) return;

            const sessions = await deps.listClassSessions.exec({
                schoolId,
                from: new Date(from),
                to: new Date(to),
                courseClassId: courseClassId ?? null
            });
            res.json({ sessions });
        } catch (err) {
            next(err);
        }
    });

    r.delete('/sessions/:sessionId', requireAuth, requireSchoolPersona, async (req, res, next) => {
        try {
            const paramsSchema = z.object({
                sessionId: z.string().uuid()
            });
            const { sessionId } = paramsSchema.parse(req.params);
            const schoolId = await resolveRequestSchoolId(req as AuthenticatedRequest, res);
            if (!schoolId) return;
            await deps.cancelClassSession.exec({ schoolId, sessionId });
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    });

    return r;
}
