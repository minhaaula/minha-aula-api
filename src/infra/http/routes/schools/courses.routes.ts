import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { CreateCourse } from '../../../../app/use-cases/courses/create-course';
import type { UpdateCourse } from '../../../../app/use-cases/courses/update-course';
import type { ListSchoolCourses } from '../../../../app/use-cases/schools/list-school-courses';
import type { GetSchoolCourse } from '../../../../app/use-cases/schools/get-school-course';
import type { CreateCourseClass } from '../../../../app/use-cases/courses/create-course-class';
import type { UpdateCourseClass } from '../../../../app/use-cases/courses/update-course-class';
import type { ListCourseClasses } from '../../../../app/use-cases/courses/list-course-classes';
import type { GetCourseClass } from '../../../../app/use-cases/courses/get-course-class';
import type { ScheduleClassSession } from '../../../../app/use-cases/courses/schedule-class-session';
import type { ListClassSessions } from '../../../../app/use-cases/courses/list-class-sessions';
import type { EnrollStudent } from '../../../../app/use-cases/enrollments/enroll-student';
import type { UnenrollStudentFromClass } from '../../../../app/use-cases/enrollments/unenroll-student-from-class';
import type { UpdateSchoolEnrollment } from '../../../../app/use-cases/schools/update-school-enrollment';
import { updateSchoolEnrollmentSchema } from '../../validators/update-school-enrollment-schemas';
import type { ListEnrollmentRequests } from '../../../../app/use-cases/enrollments/list-enrollment-requests';
import type { DeleteCourse } from '../../../../app/use-cases/courses/delete-course';
import type { DeleteCourseClass } from '../../../../app/use-cases/courses/delete-course-class';
import {
    classSessionsDateRangeSchema,
    courseClassParamsSchema,
    courseClassEnrollmentParamsSchema,
    courseIdParamSchema,
    createCourseClassSchema,
    createCourseSchema,
    updateCourseClassSchema,
    scheduleClassSessionSchema,
    updateCourseSchema
} from '../../validators/school-schemas';
import type { SchoolRouteGuards } from './guards';
import {
    enrollmentTuitionExemptionFields,
    refineEnrollmentTuitionExemption
} from '../../validators/enrollment-exemption-schemas';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';
import { mapCourseCategories } from './transformers';
import type { EnrollmentRequest } from '../../../../domain/entities/enrollment-request';
import type { EnrollmentRequestWithDetails } from '../../../../ports/repositories/enrollment-request.repo';

type CoursesRoutesDeps = {
    createCourse: CreateCourse;
    updateCourse?: UpdateCourse;
    listSchoolCourses?: ListSchoolCourses;
    getSchoolCourse?: GetSchoolCourse;
    createCourseClass: CreateCourseClass;
    updateCourseClass?: UpdateCourseClass;
    listCourseClasses?: ListCourseClasses;
    getCourseClass?: GetCourseClass;
    scheduleClassSession: ScheduleClassSession;
    listClassSessions: ListClassSessions;
    enrollStudent?: EnrollStudent;
    unenrollStudentFromClass?: UnenrollStudentFromClass;
    updateSchoolEnrollment?: UpdateSchoolEnrollment;
    listEnrollmentRequests?: ListEnrollmentRequests;
    deleteCourse?: DeleteCourse;
    deleteCourseClass?: DeleteCourseClass;
};

export function buildCoursesRoutes(deps: CoursesRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

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
            monthlyTuition: request.isTuitionExempt ? ('EXEMPT' as const) : null,
            tuitionExemptionType: request.tuitionExemptionType,
            enrollmentId: request.enrollmentId,
            createdAt: request.createdAt,
            courseLabel: 'request' in item ? item.courseLabel : null,
            courseClassLabel: 'request' in item ? item.courseClassLabel : null,
            studentName: 'request' in item ? item.studentName : null,
            dependentName: 'request' in item ? item.dependentName : null
        };
    };

    if (deps.listSchoolCourses) {
        router.get('/', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const courses = await deps.listSchoolCourses!.exec({ schoolId });
            res.json({ courses });
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

    if (deps.listCourseClasses) {
        router.get('/classes', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const courseId = normalizeCourseId(req.query.courseId);
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const classes = await deps.listCourseClasses!.exec({
                schoolId,
                courseId: courseId ?? null
            });

            if (classes === null) {
                res.status(404).json({ error: 'Course not found' });
                return;
            }

            res.json({ classes });
        }));

        router.get('/:courseId/classes', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { courseId } = courseIdParamSchema.parse(req.params);
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const classes = await deps.listCourseClasses!.exec({ schoolId, courseId });
            if (classes === null) {
                res.status(404).json({ error: 'Course not found' });
                return;
            }

            res.json({ classes });
        }));
    }

    // Rotas mais específicas devem vir ANTES das rotas genéricas
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

    if (deps.deleteCourse) {
        router.delete('/:courseId', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { courseId } = courseIdParamSchema.parse(req.params);
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            try {
                await deps.deleteCourse!.exec({ schoolId, courseId });
            } catch (error) {
                const message = error instanceof Error ? error.message : '';
                if (message === 'Course not found for this school') {
                    res.status(204).send();
                    return;
                }
                throw error;
            }
            res.status(204).send();
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

    if (deps.updateCourseClass) {
        router.put('/:courseId/classes/:classId', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { courseId, classId } = courseClassParamsSchema.parse(req.params);
            const data = updateCourseClassSchema.parse(req.body ?? {});
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const updated = await deps.updateCourseClass!.exec({
                schoolId,
                courseId,
                classId,
                label: data.label,
                classes: data.classes,
                capacity: data.capacity === undefined ? undefined : data.capacity,
                monthlyPriceCents: data.monthlyPriceCents === undefined ? undefined : data.monthlyPriceCents,
                classType: data.classType
            });

            res.json(updated);
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
            capacity: data.capacity ?? null,
            monthlyPriceCents: data.monthlyPriceCents ?? null,
            classType: data.classType
        });
        res.status(201).json(courseClass);
    }));

    if (deps.deleteCourseClass) {
        router.delete('/:courseId/classes/:classId', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { courseId, classId } = courseClassParamsSchema.parse(req.params);
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            await deps.deleteCourseClass!.exec({ schoolId, courseId, classId });
            res.status(204).send();
        }));
    }

    if (deps.enrollStudent) {
        router.post('/:courseId/classes/:classId/enrollments', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const { courseId, classId } = courseClassParamsSchema.parse(req.params);
            const bodySchema = z
                .object({
                    studentUserId: z.string().uuid(),
                    dependentId: z.string().uuid().optional(),
                    discont: z.coerce.number().min(0).optional(),
                    discountMonths: z.coerce.number().int().min(1).optional(),
                    ...enrollmentTuitionExemptionFields
                })
                .superRefine((data, ctx) => {
                    if (data.discont !== undefined && data.discont !== null && data.discont > 0) {
                        if (!data.discountMonths || data.discountMonths < 1) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                path: ['discountMonths'],
                                message: 'discountMonths é obrigatório quando há desconto (discont > 0)'
                            });
                        }
                    }
                    refineEnrollmentTuitionExemption(data, ctx);
                });
            const data = bodySchema.parse(req.body ?? {});
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const enrollment = await deps.enrollStudent!.exec({
                schoolId,
                courseId,
                classId,
                studentUserId: data.studentUserId,
                dependentId: data.dependentId ?? null,
                discount: data.discont ?? null,
                discountMonths: data.discountMonths ?? null,
                tuitionExemptionType:
                    data.monthlyTuition === 'EXEMPT' ? (data.tuitionExemptionType ?? null) : null
            });

            res.status(201).json(enrollment);
        }));
    }

    if (deps.unenrollStudentFromClass) {
        router.delete(
            '/:courseId/classes/:classId/enrollments/:enrollmentId',
            ...protectedMiddleware,
            asyncHandler(async (req, res) => {
                const { courseId, classId, enrollmentId } = courseClassEnrollmentParamsSchema.parse(req.params);
                const schoolId = (req as SchoolContextRequest).schoolId as string;

                const result = await deps.unenrollStudentFromClass!.exec({
                    schoolId,
                    courseId,
                    classId,
                    enrollmentId
                });

                res.json(result);
            })
        );
    }

    if (deps.updateSchoolEnrollment) {
        router.patch(
            '/:courseId/classes/:classId/enrollments/:enrollmentId',
            ...protectedMiddleware,
            asyncHandler(async (req, res) => {
                const { courseId, classId, enrollmentId } = courseClassEnrollmentParamsSchema.parse(req.params);
                const schoolId = (req as SchoolContextRequest).schoolId as string;
                const data = updateSchoolEnrollmentSchema.parse(req.body ?? {});

                const result = await deps.updateSchoolEnrollment!.exec({
                    schoolId,
                    courseId,
                    classId,
                    enrollmentId,
                    paymentDueDay: data.paymentDueDay,
                    firstMonthlyPaymentDate: data.firstMonthlyPaymentDate,
                    discountCents: data.clearDiscount ? null : data.discountCents,
                    discountMonths: data.clearDiscount ? null : data.discountMonths,
                    clearDiscount: data.clearDiscount,
                    monthlyTuition: data.monthlyTuition,
                    tuitionExemptionType: data.tuitionExemptionType ?? null,
                    removeTuitionExemption: data.removeTuitionExemption
                });

                res.json(result);
            })
        );
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

function normalizeCourseId(raw: unknown): string | undefined {
    if (Array.isArray(raw)) {
        raw = raw[0];
    }
    if (typeof raw !== 'string') {
        return undefined;
    }
    const trimmed = raw.trim();
    if (!trimmed || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
        return undefined;
    }
    return trimmed;
}
