import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { CreateCourse } from '../../../../app/use-cases/create-course';
import type { UpdateCourse } from '../../../../app/use-cases/update-course';
import type { ListSchoolCourses } from '../../../../app/use-cases/list-school-courses';
import type { GetSchoolCourse } from '../../../../app/use-cases/get-school-course';
import type { CreateCourseClass } from '../../../../app/use-cases/create-course-class';
import type { ListCourseClasses } from '../../../../app/use-cases/list-course-classes';
import type { GetCourseClass } from '../../../../app/use-cases/get-course-class';
import type { ScheduleClassSession } from '../../../../app/use-cases/schedule-class-session';
import type { ListClassSessions } from '../../../../app/use-cases/list-class-sessions';
import type { EnrollStudent } from '../../../../app/use-cases/enroll-student';
import type { ListEnrollmentRequests } from '../../../../app/use-cases/list-enrollment-requests';
import {
    classSessionsDateRangeSchema,
    courseClassParamsSchema,
    courseIdParamSchema,
    createCourseClassSchema,
    createCourseSchema,
    scheduleClassSessionSchema,
    updateCourseSchema
} from '../../validators/school-schemas';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';
import { mapCourseCategories } from './transformers';
import type { EnrollmentRequest } from '../../../../domain/entities/enrollment-request';

type CoursesRoutesDeps = {
    createCourse: CreateCourse;
    updateCourse?: UpdateCourse;
    listSchoolCourses?: ListSchoolCourses;
    getSchoolCourse?: GetSchoolCourse;
    createCourseClass: CreateCourseClass;
    listCourseClasses?: ListCourseClasses;
    getCourseClass?: GetCourseClass;
    scheduleClassSession: ScheduleClassSession;
    listClassSessions: ListClassSessions;
    enrollStudent?: EnrollStudent;
    listEnrollmentRequests?: ListEnrollmentRequests;
};

export function buildCoursesRoutes(deps: CoursesRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

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

    if (deps.listSchoolCourses) {
        router.get('/', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const courses = await deps.listSchoolCourses!.exec({ schoolId });
            res.json({ courses });
        }));
    }

    if (deps.getSchoolCourse) {
        router.get('/:courseId', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { courseId } = courseIdParamSchema.parse(req.params);
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const course = await deps.getSchoolCourse!.exec({ schoolId, courseId });
            if (!course) {
                res.status(404).json({ error: 'Course not found' });
                return;
            }

            res.json(course);
        }));
    }

    router.post('/', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        const data = createCourseSchema.parse(req.body);
        const course = await deps.createCourse.exec({
            schoolId,
            name: data.name,
            description: data.description ?? null,
            categories: mapCourseCategories(data.categories)
        });
        res.status(201).json(course);
    }));

    if (deps.updateCourse) {
        router.put('/:courseId', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { courseId } = courseIdParamSchema.parse(req.params);
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const data = updateCourseSchema.parse(req.body ?? {});
            const result = await deps.updateCourse!.exec({
                schoolId,
                courseId,
                name: data.name,
                description: data.description === undefined ? undefined : data.description,
                categories: mapCourseCategories(data.categories)
            });

            res.json(result);
        }));
    }

    if (deps.listCourseClasses) {
        router.get('/:courseId/classes', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { courseId } = courseIdParamSchema.parse(req.params);
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const classes = await deps.listCourseClasses!.exec({ schoolId, courseId });
            if (!classes) {
                res.status(404).json({ error: 'Course not found' });
                return;
            }

            res.json({ classes });
        }));
    }

    if (deps.listEnrollmentRequests) {
        router.get('/:courseId/classes/:classId/requests', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { classId } = courseClassParamsSchema.parse(req.params);
            const querySchema = z.object({
                status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional()
            });
            const { status } = querySchema.parse(req.query);
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const requests = await deps.listEnrollmentRequests!.exec({
                schoolId,
                courseClassId: classId,
                status: status ?? 'PENDING'
            });

            res.json({ requests: requests.map(serializeEnrollmentRequest) });
        }));
    }

    router.post('/:courseId/classes', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const { courseId } = courseIdParamSchema.parse(req.params);
        const data = createCourseClassSchema.parse(req.body);
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        const courseClass = await deps.createCourseClass.exec({
            schoolId,
            courseId,
            label: data.label,
            classes: data.classes,
            capacity: data.capacity ?? null
        });
        res.status(201).json(courseClass);
    }));

    if (deps.enrollStudent) {
        router.post('/:courseId/classes/:classId/enrollments', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { courseId, classId } = courseClassParamsSchema.parse(req.params);
            const bodySchema = z.object({
                studentUserId: z.string().uuid(),
                dependentId: z.string().uuid().optional()
            });
            const data = bodySchema.parse(req.body ?? {});
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const enrollment = await deps.enrollStudent!.exec({
                schoolId,
                courseId,
                classId,
                studentUserId: data.studentUserId,
                dependentId: data.dependentId ?? null
            });

            res.status(201).json(enrollment);
        }));
    }

    if (deps.getCourseClass) {
        router.get('/:courseId/classes/:classId', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { courseId, classId } = courseClassParamsSchema.parse(req.params);
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const courseClass = await deps.getCourseClass!.exec({ schoolId, courseId, classId });
            if (!courseClass) {
                res.status(404).json({ error: 'Course class not found' });
                return;
            }

            res.json(courseClass);
        }));
    }

    router.post('/:courseId/classes/:classId/sessions', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const { classId } = courseClassParamsSchema.parse(req.params);
        const data = scheduleClassSessionSchema.parse(req.body);
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        const session = await deps.scheduleClassSession.exec({
            schoolId,
            courseClassId: classId,
            startsAt: new Date(data.startsAt),
            endsAt: new Date(data.endsAt),
            location: data.location ?? null,
            notes: data.notes ?? null
        });
        res.status(201).json(session);
    }));

    router.get('/:courseId/classes/:classId/sessions', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const { classId } = courseClassParamsSchema.parse(req.params);
        const { from, to } = classSessionsDateRangeSchema.parse(req.query);
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        const sessions = await deps.listClassSessions.exec({
            schoolId,
            courseClassId: classId,
            from: new Date(from),
            to: new Date(to)
        });
        res.json({ sessions });
    }));

    return router;
}
