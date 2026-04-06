import { describe, expect, it } from 'vitest';
import { UnenrollStudentFromClass } from '../../src/app/use-cases/unenroll-student-from-class';
import type { CourseRepository } from '../../src/ports/repositories/course.repo';
import type { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import type { EnrollmentRepository } from '../../src/ports/repositories/enrollment.repo';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';
import { Enrollment } from '../../src/domain/entities/enrollment';
import { AppError } from '../../src/shared/errors';

class InMemoryCourseRepository implements CourseRepository {
    private readonly items = new Map<string, Course>();
    async findById(id: string): Promise<Course | null> {
        return this.items.get(id) ?? null;
    }
    async findBySchoolAndName(): Promise<Course | null> {
        return null;
    }
    async findBySchoolId(schoolId: string): Promise<Course[]> {
        return [...this.items.values()].filter((c) => c.schoolId === schoolId);
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
    async findByCourseAndLabel(): Promise<CourseClass | null> {
        return null;
    }
    async findByCourseId(courseId: string): Promise<CourseClass[]> {
        return [...this.items.values()].filter((c) => c.courseId === courseId);
    }
    async findByCourseIds(courseIds: string[]): Promise<CourseClass[]> {
        const set = new Set(courseIds);
        return [...this.items.values()].filter((c) => set.has(c.courseId));
    }
    async save(courseClass: CourseClass): Promise<void> {
        this.items.set(courseClass.id, courseClass);
    }
    seed(courseClass: CourseClass) {
        this.items.set(courseClass.id, courseClass);
    }
}

class InMemoryEnrollmentRepository implements EnrollmentRepository {
    private readonly items = new Map<string, Enrollment>();
    async findById(id: string): Promise<Enrollment | null> {
        return this.items.get(id) ?? null;
    }
    async findByClassAndUser(): Promise<Enrollment | null> {
        return null;
    }
    async findByClassAndDependent(): Promise<Enrollment | null> {
        return null;
    }
    async findActiveByClassIds(): Promise<Enrollment[]> {
        return [];
    }
    async findActiveByDependentId(): Promise<Enrollment[]> {
        return [];
    }
    async save(enrollment: Enrollment): Promise<void> {
        this.items.set(enrollment.id, enrollment);
    }
    get(id: string) {
        return this.items.get(id) ?? null;
    }
    seed(enrollment: Enrollment) {
        this.items.set(enrollment.id, enrollment);
    }
}

const makeCourse = () =>
    Course.create({
        id: 'course-1',
        schoolId: 'school-1',
        name: 'Curso Teste'
    });

const makeClass = () =>
    CourseClass.create({
        id: 'class-1',
        courseId: 'course-1',
        label: 'Turma A',
        schedule: [{ day: 'Segunda', start: '08:00', end: '09:00' }]
    });

describe('UnenrollStudentFromClass', () => {
    it('define matrícula como CANCELLED sem alterar cobranças (repositório só persiste matrícula)', async () => {
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        courses.seed(makeCourse());
        classes.seed(makeClass());
        enrollments.seed(
            Enrollment.createForUser({
                id: 'enr-1',
                courseClassId: 'class-1',
                ownerUserId: 'user-1',
                studentUserId: 'user-1'
            })
        );

        const useCase = new UnenrollStudentFromClass(courses, classes, enrollments);
        const result = await useCase.exec({
            schoolId: 'school-1',
            courseId: 'course-1',
            classId: 'class-1',
            enrollmentId: 'enr-1'
        });

        expect(result.status).toBe('CANCELLED');
        expect(result.enrollmentId).toBe('enr-1');
        expect(enrollments.get('enr-1')?.status).toBe('CANCELLED');
    });

    it('rejeita quando matrícula já cancelada', async () => {
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        courses.seed(makeCourse());
        classes.seed(makeClass());
        const e = Enrollment.createForUser({
            id: 'enr-2',
            courseClassId: 'class-1',
            ownerUserId: 'user-1',
            studentUserId: 'user-1',
            status: 'ACTIVE'
        });
        e.cancel();
        enrollments.seed(e);

        const useCase = new UnenrollStudentFromClass(courses, classes, enrollments);
        await expect(
            useCase.exec({
                schoolId: 'school-1',
                courseId: 'course-1',
                classId: 'class-1',
                enrollmentId: 'enr-2'
            })
        ).rejects.toThrow(AppError);
    });

    it('retorna ENROLLMENT_NOT_FOUND quando matrícula não pertence à turma', async () => {
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        courses.seed(makeCourse());
        classes.seed(makeClass());
        enrollments.seed(
            Enrollment.createForUser({
                id: 'enr-3',
                courseClassId: 'outra-turma',
                ownerUserId: 'user-1',
                studentUserId: 'user-1'
            })
        );

        const useCase = new UnenrollStudentFromClass(courses, classes, enrollments);
        await expect(
            useCase.exec({
                schoolId: 'school-1',
                courseId: 'course-1',
                classId: 'class-1',
                enrollmentId: 'enr-3'
            })
        ).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND' });
    });
});
