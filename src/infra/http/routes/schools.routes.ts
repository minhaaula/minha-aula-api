import { Router, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { CreateSchool } from '../../../app/use-cases/create-school';
import { CreateCourse } from '../../../app/use-cases/create-course';
import { CreateCourseClass } from '../../../app/use-cases/create-course-class';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AuthenticatedRequest } from '../middlewares/auth';
import { SchoolRepository } from '../../../ports/repositories/school.repo';

export function schoolsRouter(deps: {
    createSchool: CreateSchool;
    createCourse: CreateCourse;
    createCourseClass: CreateCourseClass;
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

    r.post('/', optionalAuth, async (req, res, next) => {
        try {
            const addressSchema = z.object({
                street: z.string().trim().min(1),
                number: z.string().trim().min(1),
                complement: z.string().trim().min(1).optional().nullable(),
                district: z.string().trim().min(1).optional().nullable(),
                city: z.string().trim().min(1),
                state: z.string().trim().min(1),
                zipCode: z.string().trim().min(1)
            });

            const categorySchema = z.object({
                categoryId: z.string().trim().min(1),
                subcategoryIds: z.array(z.string().trim().min(1)).optional()
            });

            const schema = z.object({
                name: z.string().trim().min(3),
                email: z.string().trim().email(),
                phone: z.string().trim().min(8)
                    .refine((value) => value.replace(/[^\d]/g, '').length >= 10, { message: 'Invalid phone' }),
                cnpj: z.string().trim().min(3)
                    .refine((value) => value.replace(/[^\d]/g, '').length === 14, { message: 'Invalid CNPJ' }),
                addresses: z.array(addressSchema).optional(),
                categories: z.array(categorySchema).optional()
            });

            const data = schema.parse(req.body);
            const authReq = req as AuthenticatedRequest;
            const ownerUserId = authReq.user?.persona === UserPersonaEnum.SCHOOL ? authReq.user.sub : null;

            const school = await deps.createSchool.exec({
                name: data.name,
                email: data.email,
                phone: data.phone,
                cnpj: data.cnpj,
                categories: data.categories?.map((category) => ({
                    categoryId: category.categoryId,
                    subcategoryIds: category.subcategoryIds ?? []
                })),
                addresses: data.addresses?.map((address) => ({
                    street: address.street,
                    number: address.number,
                    complement: address.complement ?? null,
                    district: address.district ?? null,
                    city: address.city,
                    state: address.state,
                    zipCode: address.zipCode
                })),
                ownerUserId
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
            const bodySchema = z.object({
                name: z.string().min(3),
                description: z.string().min(1).optional()
            });
            const data = bodySchema.parse(req.body);
            const course = await deps.createCourse.exec({
                schoolId,
                name: data.name,
                description: data.description ?? null
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

    return r;
}
