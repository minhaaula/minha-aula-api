import { ClassSessionRepository } from '../../ports/repositories/class-session.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';

export class ListClassSessions {
    constructor(
        private readonly sessions: ClassSessionRepository,
        private readonly classes: CourseClassRepository,
        private readonly courses: CourseRepository
    ) {}

    async exec(input: {
        schoolId: string;
        from: Date;
        to: Date;
        courseClassId?: string | null;
    }): Promise<Array<{
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
    }>> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) throw new Error('School id is required');

        const from = new Date(input.from);
        const to = new Date(input.to);

        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw new Error('Invalid date interval');
        }

        if (to <= from) throw new Error('Range end must be after start');

        const courseClassId = input.courseClassId?.trim() || null;

        if (courseClassId) {
            const courseClass = await this.classes.findById(courseClassId);

            if (!courseClass || !courseClass.isActive) throw new Error('Course class not found');

            const course = await this.courses.findById(courseClass.courseId);

            if (!course || !course.isActive || course.schoolId !== schoolId) {
                throw new Error('Course class not found for this school');
            }

            const sessions = await this.sessions.findByClassAndInterval({ courseClassId, from, to });
            
            return sessions.map((session) => ({
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
            }));
        }

        const sessions = await this.sessions.findBySchoolAndInterval({ schoolId, from, to, courseClassId: null });
        return sessions.map((session) => ({
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
        }));
    }
}
