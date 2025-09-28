import { describe, expect, it } from 'vitest';
import { CreateSchool } from '../../src/app/use-cases/create-school';
import { CreateCourse } from '../../src/app/use-cases/create-course';
import { CreateCourseClass } from '../../src/app/use-cases/create-course-class';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import { School } from '../../src/domain/entities/school';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';

class InMemorySchoolRepository implements SchoolRepository {
    private readonly items = new Map<string, School>();

    async findById(id: string): Promise<School | null> {
        return this.items.get(id) ?? null;
    }

    async save(school: School): Promise<void> {
        this.items.set(school.id, school);
    }

    seed(school: School) {
        this.items.set(school.id, school);
    }
}

class InMemoryCourseRepository implements CourseRepository {
    private readonly items = new Map<string, Course>();

    async findById(id: string): Promise<Course | null> {
        return this.items.get(id) ?? null;
    }

    async findBySchoolAndName(schoolId: string, name: string): Promise<Course | null> {
        const normalized = name.trim();
        return Array.from(this.items.values()).find((course) => course.schoolId === schoolId && course.name === normalized) ?? null;
    }

    async save(course: Course): Promise<void> {
        this.items.set(course.id, course);
    }

    seed(course: Course) {
        this.items.set(course.id, course);
    }
}

class InMemoryCourseClassRepository implements CourseClassRepository {
    private readonly classes = new Map<string, CourseClass>();

    async findById(id: string): Promise<CourseClass | null> {
        return this.classes.get(id) ?? null;
    }

    async findByCourseAndLabel(courseId: string, label: string): Promise<CourseClass | null> {
        return Array.from(this.classes.values()).find((cls) => cls.courseId === courseId && cls.label === label) ?? null;
    }

    async save(courseClass: CourseClass): Promise<void> {
        this.classes.set(courseClass.id, courseClass);
    }
}

describe('School creation flow', () => {
    it('creates and persists a new school', async () => {
        const repo = new InMemorySchoolRepository();
        const useCase = new CreateSchool(repo);

        const result = await useCase.exec({ name: '  Escola Central  ' });

        expect(result.id).toBeTruthy();
        const stored = await repo.findById(result.id);
        expect(stored).toBeTruthy();
        expect(stored?.name).toBe('Escola Central');
    });

    it('creates a course for an existing school and prevents duplicates', async () => {
        const schools = new InMemorySchoolRepository();
        const courses = new InMemoryCourseRepository();
        const school = School.create({ id: 'school-1', name: 'Escola XPTO', createdAt: new Date('2024-01-01') });
        schools.seed(school);
        const useCase = new CreateCourse(schools, courses);

        const course = await useCase.exec({ schoolId: school.id, name: 'Curso A', description: null });
        expect(course.schoolId).toBe(school.id);
        expect(course.name).toBe('Curso A');

        await expect(useCase.exec({ schoolId: school.id, name: 'Curso A' })).rejects.toThrow('Course name already in use for this school');
    });

    it('creates a course class when course belongs to the school', async () => {
        const schools = new InMemorySchoolRepository();
        const courses = new InMemoryCourseRepository();
        const courseClasses = new InMemoryCourseClassRepository();

        const school = School.create({ id: 'school-1', name: 'Escola XPTO', createdAt: new Date('2024-01-01') });
        const course = Course.create({ id: 'course-1', schoolId: school.id, name: 'Curso A', description: null, isActive: true, createdAt: new Date('2024-01-02') });
        schools.seed(school);
        courses.seed(course);

        const useCase = new CreateCourseClass(courses, courseClasses);
        const result = await useCase.exec({
            schoolId: school.id,
            courseId: course.id,
            label: 'Turma A',
            capacity: 20
        });

        expect(result.courseId).toBe(course.id);
        expect(result.label).toBe('Turma A');

        await expect(useCase.exec({ schoolId: school.id, courseId: course.id, label: 'Turma A' })).rejects.toThrow('Class label already in use for this course');
        await expect(useCase.exec({ schoolId: 'other-school', courseId: course.id, label: 'Turma B' })).rejects.toThrow('Course not found for this school');
    });

    it('accepts school identifiers with different casing when creating a course class', async () => {
        const courses = new InMemoryCourseRepository();
        const courseClasses = new InMemoryCourseClassRepository();

        const course = Course.create({
            id: 'course-2',
            schoolId: 'school-2',
            name: 'Curso B',
            description: null,
            isActive: true,
            createdAt: new Date('2024-01-03')
        });
        courses.seed(course);

        const useCase = new CreateCourseClass(courses, courseClasses);
        const result = await useCase.exec({
            schoolId: 'SCHOOL-2',
            courseId: course.id,
            label: 'Turma B'
        });

        expect(result.courseId).toBe(course.id);
        expect(result.label).toBe('Turma B');
    });
});
