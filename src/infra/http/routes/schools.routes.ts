import { Router } from 'express';
import { z } from 'zod';
import { CreateSchool } from '../../../app/use-cases/create-school';
import { CreateCourse } from '../../../app/use-cases/create-course';
import { CreateCourseClass } from '../../../app/use-cases/create-course-class';

export function schoolsRouter(deps: {
    createSchool: CreateSchool;
    createCourse: CreateCourse;
    createCourseClass: CreateCourseClass;
}) {
    const r = Router();

    r.post('/', async (req, res, next) => {
        try {
            const schema = z.object({ name: z.string().min(3) });
            const data = schema.parse(req.body);
            const school = await deps.createSchool.exec({ name: data.name });
            res.status(201).json(school);
        } catch (err) {
            next(err);
        }
    });

    r.post('/:schoolId/courses', async (req, res, next) => {
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

    r.post('/:schoolId/courses/:courseId/classes', async (req, res, next) => {
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
