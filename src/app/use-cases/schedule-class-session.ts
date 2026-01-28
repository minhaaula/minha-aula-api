import { ClassSession } from '../../domain/entities/class-session';
import { ClassSessionRepository } from '../../ports/repositories/class-session.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { Uuid } from '../../shared/uuid';
import { AppError, ErrorCode } from '../../shared/errors';

export class ScheduleClassSession {
    constructor(
        private readonly sessions: ClassSessionRepository,
        private readonly classes: CourseClassRepository,
        private readonly courses: CourseRepository
    ) {}

    async exec(input: {
        schoolId: string;
        courseClassId: string;
        startsAt: Date;
        endsAt: Date;
        location?: string | null;
        notes?: string | null;
    }): Promise<{
        id: string;
        schoolId: string;
        courseClassId: string;
        startsAt: Date;
        endsAt: Date;
        status: string;
        location: string | null;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
    }> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        const courseClassId = input.courseClassId.trim();
        if (!courseClassId) throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'courseClassId' });

        const startsAt = new Date(input.startsAt);
        const endsAt = new Date(input.endsAt);
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
            throw AppError.fromCode(ErrorCode.INVALID_DATE_RANGE, { message: 'Invalid session time range' });
        }

        const courseClass = await this.classes.findById(courseClassId);
        if (!courseClass || !courseClass.isActive) throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, { courseClassId });

        const course = await this.courses.findById(courseClass.courseId);
        if (!course || !course.isActive || course.schoolId !== schoolId) {
            throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, { courseClassId, schoolId });
        }

        const conflictingSessions = await this.sessions.findByClassAndInterval({
            courseClassId,
            from: startsAt,
            to: endsAt
        });
        if (conflictingSessions.some((item) => item.status !== 'CANCELLED')) {
            throw AppError.fromCode(ErrorCode.CLASS_SESSION_OVERLAP, { courseClassId, startsAt, endsAt });
        }

        const session = ClassSession.create({
            id: Uuid(),
            schoolId,
            courseClassId,
            startsAt,
            endsAt,
            location: input.location ?? null,
            notes: input.notes ?? null
        });

        await this.sessions.save(session);

        return {
            id: session.id,
            schoolId: session.schoolId,
            courseClassId: session.courseClassId,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            status: session.status,
            location: session.location,
            notes: session.notes,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
        };
    }
}
