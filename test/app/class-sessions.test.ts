import { describe, expect, it } from 'vitest';
import { ScheduleClassSession } from '../../src/app/use-cases/schedule-class-session';
import { ListClassSessions } from '../../src/app/use-cases/list-class-sessions';
import { CancelClassSession } from '../../src/app/use-cases/cancel-class-session';
import { ClassSessionRepository } from '../../src/ports/repositories/class-session.repo';
import { ClassSession } from '../../src/domain/entities/class-session';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';
import { equalUuid } from '../../src/shared/normalize-uuid';

class InMemoryClassSessionRepository implements ClassSessionRepository {
    private readonly sessions = new Map<string, ClassSession>();

    async findById(id: string): Promise<ClassSession | null> {
        return this.sessions.get(id) ?? null;
    }

    async findByClassAndInterval(params: { courseClassId: string; from: Date; to: Date }): Promise<ClassSession[]> {
        const from = params.from.getTime();
        const to = params.to.getTime();
        return Array.from(this.sessions.values()).filter((session) => {
            if (!equalUuid(session.courseClassId, params.courseClassId)) return false;
            if (session.status === 'CANCELLED') return false;
            const start = session.startsAt.getTime();
            const end = session.endsAt.getTime();
            return start < to && end > from;
        }).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    }

    async findBySchoolAndInterval(params: { schoolId: string; from: Date; to: Date; courseClassId?: string | null; }): Promise<ClassSession[]> {
        const from = params.from.getTime();
        const to = params.to.getTime();
        return Array.from(this.sessions.values()).filter((session) => {
            if (!equalUuid(session.schoolId, params.schoolId)) return false;
            if (session.status === 'CANCELLED') return false;
            if (params.courseClassId && !equalUuid(session.courseClassId, params.courseClassId)) return false;
            const start = session.startsAt.getTime();
            const end = session.endsAt.getTime();
            return start < to && end > from;
        }).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    }

    async save(session: ClassSession): Promise<void> {
        this.sessions.set(session.id, session);
    }

    async delete(id: string): Promise<void> {
        this.sessions.delete(id);
    }
}

class InMemoryCourseRepository implements CourseRepository {
    private readonly items = new Map<string, Course>();

    async findById(id: string): Promise<Course | null> {
        return this.items.get(id) ?? null;
    }

    async findByIdIncludingDeleted(id: string): Promise<Course | null> {
        return this.items.get(id) ?? null;
    }

    async findBySchoolAndName(_schoolId: string, _name: string): Promise<Course | null> {
        return null;
    }

    async findBySchoolId(schoolId: string): Promise<Course[]> {
        return Array.from(this.items.values())
            .filter((course) => equalUuid(course.schoolId, schoolId))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    async save(course: Course): Promise<void> {
        this.items.set(course.id, course);
    }

    seed(course: Course) {
        this.items.set(course.id, course);
    }
}

class InMemoryCourseClassRepository implements CourseClassRepository {
    private readonly items = new Map<string, CourseClass>();

    async findById(id: string): Promise<CourseClass | null> {
        return this.items.get(id) ?? null;
    }

    async findByCourseAndLabel(_courseId: string, _label: string): Promise<CourseClass | null> {
        return null;
    }

    async findByCourseId(courseId: string): Promise<CourseClass[]> {
        return Array.from(this.items.values())
            .filter((cls) => equalUuid(cls.courseId, courseId))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    async findByCourseIds(courseIds: string[]): Promise<CourseClass[]> {
        if (courseIds.length === 0) return [];
        return Array.from(this.items.values())
            .filter((cls) => courseIds.some((courseId) => equalUuid(cls.courseId, courseId)))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    async save(courseClass: CourseClass): Promise<void> {
        this.items.set(courseClass.id, courseClass);
    }

    seed(courseClass: CourseClass) {
        this.items.set(courseClass.id, courseClass);
    }
}

describe('Class session scheduling', () => {
    const schoolId = 'school-1';
    const courseId = 'course-1';
    const classId = 'class-1';

    function bootstrap() {
        const sessionsRepo = new InMemoryClassSessionRepository();
        const coursesRepo = new InMemoryCourseRepository();
        const classesRepo = new InMemoryCourseClassRepository();
        coursesRepo.seed(Course.create({
            id: courseId,
            schoolId,
            name: 'Course',
            categoryId: 'infantil',
            subcategoryId: 'alfabetizacao'
        }));
        classesRepo.seed(CourseClass.create({
            id: classId,
            courseId,
            label: 'A',
            schedule: [{ day: 'Segunda', start: '08:00', end: '09:00' }]
        }));
        const schedule = new ScheduleClassSession(sessionsRepo, classesRepo, coursesRepo);
        const list = new ListClassSessions(sessionsRepo, classesRepo, coursesRepo);
        const cancel = new CancelClassSession(sessionsRepo);
        return { schedule, list, cancel, sessionsRepo };
    }

    it('creates a new class session', async () => {
        const { schedule, sessionsRepo } = bootstrap();
        const result = await schedule.exec({
            schoolId,
            courseClassId: classId,
            startsAt: new Date('2024-01-10T13:00:00Z'),
            endsAt: new Date('2024-01-10T14:00:00Z'),
            location: 'Sala 1',
            notes: 'Primeira aula'
        });

        expect(result.id).toBeTruthy();
        expect(result.status).toBe('SCHEDULED');
        expect(result.location).toBe('Sala 1');
        const stored = await sessionsRepo.findById(result.id);
        expect(stored).toBeTruthy();
        expect(stored?.startsAt.toISOString()).toBe('2024-01-10T13:00:00.000Z');
    });

    it('prevents overlapping sessions for the same class', async () => {
        const { schedule } = bootstrap();
        await schedule.exec({
            schoolId,
            courseClassId: classId,
            startsAt: new Date('2024-01-10T13:00:00Z'),
            endsAt: new Date('2024-01-10T14:00:00Z')
        });

        await expect(schedule.exec({
            schoolId,
            courseClassId: classId,
            startsAt: new Date('2024-01-10T13:30:00Z'),
            endsAt: new Date('2024-01-10T14:30:00Z')
        })).rejects.toThrow('Class session overlaps with an existing one');
    });

    it('lists sessions for a class within an interval', async () => {
        const { schedule, list } = bootstrap();
        await schedule.exec({
            schoolId,
            courseClassId: classId,
            startsAt: new Date('2024-01-10T13:00:00Z'),
            endsAt: new Date('2024-01-10T14:00:00Z')
        });
        await schedule.exec({
            schoolId,
            courseClassId: classId,
            startsAt: new Date('2024-01-11T13:00:00Z'),
            endsAt: new Date('2024-01-11T14:00:00Z')
        });

        const sessions = await list.exec({
            schoolId,
            courseClassId: classId,
            from: new Date('2024-01-09T00:00:00Z'),
            to: new Date('2024-01-12T00:00:00Z')
        });

        expect(sessions).toHaveLength(2);
        expect(sessions[0].startsAt.toISOString()).toBe('2024-01-10T13:00:00.000Z');
    });

    it('cancels a session and removes it from listings', async () => {
        const { schedule, list, cancel } = bootstrap();
        const { id } = await schedule.exec({
            schoolId,
            courseClassId: classId,
            startsAt: new Date('2024-01-10T13:00:00Z'),
            endsAt: new Date('2024-01-10T14:00:00Z')
        });

        await cancel.exec({ schoolId, sessionId: id });

        const sessions = await list.exec({
            schoolId,
            courseClassId: classId,
            from: new Date('2024-01-09T00:00:00Z'),
            to: new Date('2024-01-12T00:00:00Z')
        });

        expect(sessions).toHaveLength(0);
    });
});
