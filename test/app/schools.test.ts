import { describe, expect, it } from 'vitest';
import { CreateSchool } from '../../src/app/use-cases/create-school';
import { CreateCourse } from '../../src/app/use-cases/create-course';
import { CreateCourseClass } from '../../src/app/use-cases/create-course-class';
import { ListSchools } from '../../src/app/use-cases/list-schools';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import { School } from '../../src/domain/entities/school';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';

class InMemorySchoolRepository implements SchoolRepository {
    private readonly items = new Map<string, School>();

    async findById(id: string): Promise<School | null> {
        return this.items.get(id) ?? null;
    }

    async findAll(): Promise<School[]> {
        return Array.from(this.items.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
    it('creates and persists a new school with addresses', async () => {
        const repo = new InMemorySchoolRepository();
        const useCase = new CreateSchool(repo);

        const result = await useCase.exec({
            name: '  Escola Central  ',
            email: 'contato@central.com',
            phone: '(11) 99876-5432',
            cnpj: '12.345.678/0001-90',
            addresses: [{
                street: 'Rua Central',
                number: '100',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234-000'
            }]
        });

        expect(result.id).toBeTruthy();
        expect(result.addresses).toHaveLength(1);
        expect(result.addresses[0]).toMatchObject({
            street: 'Rua Central',
            number: '100',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234000'
        });
        const stored = await repo.findById(result.id);
        expect(stored).toBeTruthy();
        expect(stored?.name).toBe('Escola Central');
        expect(stored?.addresses).toHaveLength(1);
        expect(stored?.addresses[0].zipCode).toBe('01234000');
        expect(stored?.email).toBe('contato@central.com');
        expect(stored?.phone).toBe('11998765432');
        expect(stored?.cnpj).toBe('12345678000190');
    });

    it('creates a school without addresses when none are provided', async () => {
        const repo = new InMemorySchoolRepository();
        const useCase = new CreateSchool(repo);

        const result = await useCase.exec({
            name: 'Escola Sem Endereço',
            email: 'contato@semendereco.com',
            phone: '11912345678',
            cnpj: '11.222.333/0001-44'
        });

        expect(result.addresses).toHaveLength(0);
        const stored = await repo.findById(result.id);
        expect(stored?.addresses).toHaveLength(0);
        expect(stored?.phone).toBe('11912345678');
    });

    it('lists schools with addresses ordered by creation date', async () => {
        const repo = new InMemorySchoolRepository();
        const listSchools = new ListSchools(repo);

        const older = School.create({
            id: 'school-older',
            name: 'Escola Antiga',
            email: 'antiga@escola.com',
            phone: '1133334444',
            cnpj: '12345678000190',
            addresses: [PostalAddress.create({
                street: 'Rua 1',
                number: '10',
                city: 'Rio',
                state: 'RJ',
                zipCode: '20000-000'
            })],
            createdAt: new Date('2023-01-01')
        });

        const newer = School.create({
            id: 'school-new',
            name: 'Escola Nova',
            email: 'nova@escola.com',
            phone: '1144445555',
            cnpj: '12345678000199',
            addresses: [PostalAddress.create({
                street: 'Rua 2',
                number: '20',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234-000'
            })],
            createdAt: new Date('2024-01-01')
        });

        repo.seed(older);
        repo.seed(newer);

        const result = await listSchools.exec();
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('school-new');
        expect(result[0].addresses[0].zipCode).toBe('01234000');
        expect(result[1].id).toBe('school-older');
        expect(result[0].email).toBe('nova@escola.com');
    });

    it('creates a course for an existing school and prevents duplicates', async () => {
        const schools = new InMemorySchoolRepository();
        const courses = new InMemoryCourseRepository();
        const school = School.create({
            id: 'school-1',
            name: 'Escola XPTO',
            email: 'contato@xpto.com',
            phone: '1199998888',
            cnpj: '55667788000111',
            createdAt: new Date('2024-01-01')
        });
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

        const school = School.create({
            id: 'school-1',
            name: 'Escola XPTO',
            email: 'contato@xpto.com',
            phone: '1199998888',
            cnpj: '55667788000111',
            createdAt: new Date('2024-01-01')
        });
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
