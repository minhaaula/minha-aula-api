import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { CreateSchool } from '../../../app/use-cases/create-school';
import { CreateCourse } from '../../../app/use-cases/create-course';
import { CreateCourseClass } from '../../../app/use-cases/create-course-class';
import { ListSchools } from '../../../app/use-cases/list-schools';

export function schoolsRouter(deps: {
    createSchool: CreateSchool;
    listSchools: ListSchools;
    createCourse: CreateCourse;
    createCourseClass: CreateCourseClass;
    authMiddleware?: RequestHandler;
}) {
    const r = Router();
    const requireAuth: RequestHandler = deps.authMiddleware ?? ((_req, _res, next) => next());

    r.get('/', async (_req, res, next) => {
        try {
            const schools = await deps.listSchools.exec();
            res.json({ schools });
        } catch (err) {
            next(err);
        }
    });

    r.post('/', async (req, res, next) => {
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

            const schema = z.object({
                name: z.string().trim().min(3),
                addresses: z.array(addressSchema).optional()
            });
            const data = schema.parse(req.body);
            const school = await deps.createSchool.exec({
                name: data.name,
                addresses: data.addresses?.map((address) => ({
                    street: address.street,
                    number: address.number,
                    complement: address.complement ?? null,
                    district: address.district ?? null,
                    city: address.city,
                    state: address.state,
                    zipCode: address.zipCode
                }))
            });
            res.status(201).json(school);
        } catch (err) {
            next(err);
        }
    });

    r.post('/:schoolId/courses', requireAuth, async (req, res, next) => {
        try {
            const paramsSchema = z.object({ schoolId: z.string().uuid() });
            const { schoolId } = paramsSchema.parse(req.params);
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

    r.post('/:schoolId/courses/:courseId/classes', requireAuth, async (req, res, next) => {
        try {
            const paramsSchema = z.object({
                schoolId: z.string().uuid(),
                courseId: z.string().uuid()
            });
            const { schoolId, courseId } = paramsSchema.parse(req.params);
            const bodySchema = z.object({
                label: z.string().min(1),
                shift: z.string().min(1).optional(),
                capacity: z.number().int().positive().optional(),
                startsAt: z.string().datetime().optional(),
                endsAt: z.string().datetime().optional()
            });
            const data = bodySchema.parse(req.body);
            const startsAt = data.startsAt ? new Date(data.startsAt) : null;
            const endsAt = data.endsAt ? new Date(data.endsAt) : null;
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
