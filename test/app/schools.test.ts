import { describe, expect, it } from 'vitest';
import { CreateSchool } from '../../src/app/use-cases/create-school';
import { CreateCourse } from '../../src/app/use-cases/create-course';
import { CreateCourseClass } from '../../src/app/use-cases/create-course-class';
import { ListSchools } from '../../src/app/use-cases/list-schools';
import { ListSchoolCourses } from '../../src/app/use-cases/list-school-courses';
import { GetSchoolCourse } from '../../src/app/use-cases/get-school-course';
import { ListCourseClasses } from '../../src/app/use-cases/list-course-classes';
import { GetCourseClass } from '../../src/app/use-cases/get-course-class';
import { GetSchoolProfile } from '../../src/app/use-cases/get-school-profile';
import { UpdateSchool } from '../../src/app/use-cases/update-school';
import { UpdateCourse } from '../../src/app/use-cases/update-course';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { CategoryRepository } from '../../src/ports/repositories/category.repo';
import { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import { School } from '../../src/domain/entities/school';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { PasswordHasherPort } from '../../src/ports/providers/password-hasher.port';
import { LoginSchool } from '../../src/app/use-cases/login-school';
import { TokenProviderPort } from '../../src/ports/providers/token-provider.port';
import { equalUuid } from '../../src/shared/normalize-uuid';

class InMemorySchoolRepository implements SchoolRepository {
    private readonly items = new Map<string, School>();

    async findById(id: string): Promise<School | null> {
        return this.items.get(id) ?? null;
    }

    async findByEmail(email: string): Promise<School | null> {
        const normalized = email.trim().toLowerCase();
        if (!normalized) return null;
        return (
            Array.from(this.items.values()).find((item) => item.email === normalized) ?? null
        );
    }

    async findByOwnerUserId(userId: string): Promise<School | null> {
        const normalized = userId.trim();
        if (!normalized) return null;
        return (
            Array.from(this.items.values()).find((item) => item.ownerUserId === normalized) ?? null
        );
    }

    async findByOwnerEmail(email: string): Promise<School | null> {
        const normalized = email.trim().toLowerCase();
        if (!normalized) return null;
        return (
            Array.from(this.items.values()).find((item) => item.ownerEmail === normalized) ?? null
        );
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
        return Array.from(this.items.values()).find((course) => equalUuid(course.schoolId, schoolId) && course.name === normalized) ?? null;
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

class InMemoryCategoryRepository implements CategoryRepository {
    private readonly items = new Map<string, { name: string; subcategories: Array<{ id: string; name: string }> }>();

    async findAllWithSubcategories(): Promise<Array<{
        id: string;
        name: string;
        subcategories: Array<{ id: string; name: string }>;
    }>> {
        return Array.from(this.items.entries()).map(([id, category]) => ({
            id,
            name: category.name,
            subcategories: category.subcategories.map((sub) => ({ ...sub }))
        }));
    }

    seed(category: { id: string; name: string; subcategories?: Array<{ id: string; name: string }> }) {
        this.items.set(category.id, {
            name: category.name,
            subcategories: category.subcategories ? category.subcategories.map((sub) => ({ ...sub })) : []
        });
    }
}

class InMemoryCourseClassRepository implements CourseClassRepository {
    private readonly classes = new Map<string, CourseClass>();

    async findById(id: string): Promise<CourseClass | null> {
        return this.classes.get(id) ?? null;
    }

    async findByCourseAndLabel(courseId: string, label: string): Promise<CourseClass | null> {
        return Array.from(this.classes.values()).find((cls) => equalUuid(cls.courseId, courseId) && cls.label === label) ?? null;
    }

    async findByCourseId(courseId: string): Promise<CourseClass[]> {
        return Array.from(this.classes.values())
            .filter((cls) => equalUuid(cls.courseId, courseId))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    async findByCourseIds(courseIds: string[]): Promise<CourseClass[]> {
        if (courseIds.length === 0) return [];
        return Array.from(this.classes.values())
            .filter((cls) => courseIds.some((courseId) => equalUuid(cls.courseId, courseId)))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    async save(courseClass: CourseClass): Promise<void> {
        this.classes.set(courseClass.id, courseClass);
    }

    seed(courseClass: CourseClass) {
        this.classes.set(courseClass.id, courseClass);
    }
}

class TestPasswordHasher implements PasswordHasherPort {
    async hash(plain: string): Promise<string> {
        return `hashed:${plain}`;
    }

    async compare(plain: string, hashed: string): Promise<boolean> {
        return hashed === `hashed:${plain}`;
    }
}

class TestTokenProvider implements TokenProviderPort {
    async sign(payload: Record<string, unknown>): Promise<string> {
        const schoolId = typeof payload.schoolId === 'string' ? payload.schoolId : String(payload.sub ?? 'unknown');
        return `token-${schoolId}`;
    }

    async verify<T = Record<string, unknown>>(_token: string): Promise<T> {
        throw new Error('Not implemented');
    }
}

describe('School creation flow', () => {
    it('creates and persists a new school with addresses', async () => {
        const repo = new InMemorySchoolRepository();
        const useCase = new CreateSchool(repo, new TestPasswordHasher());

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
        expect(result.ownerUserId).toBeNull();
        expect(result.addresses).toHaveLength(1);
        expect(result.ownerName).toBeNull();
        expect(result.ownerCpf).toBeNull();
        expect(result.ownerEmail).toBeNull();
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
        const useCase = new CreateSchool(repo, new TestPasswordHasher());

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
        expect(stored?.ownerName).toBeNull();
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
        expect(result[0].ownerName).toBeNull();
        expect(result[0].ownerCpf).toBeNull();
        expect(result[0].ownerEmail).toBeNull();
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

        const course = await useCase.exec({
            schoolId: school.id,
            name: 'Curso A',
            description: null,
            categories: [{ categoryId: 'infantil', subcategoryIds: ['alfabetizacao'] }]
        });
        expect(course.schoolId).toBe(school.id);
        expect(course.name).toBe('Curso A');
        expect(course.categories).toEqual([
            { categoryId: 'infantil', subcategoryIds: ['alfabetizacao'] }
        ]);

        await expect(useCase.exec({
            schoolId: school.id,
            name: 'Curso A',
            categories: [{ categoryId: 'infantil', subcategoryIds: ['alfabetizacao'] }]
        })).rejects.toThrow('Course name already in use for this school');
    });

    it('updates a course details and categories', async () => {
        const schools = new InMemorySchoolRepository();
        const courses = new InMemoryCourseRepository();

        const school = School.create({
            id: 'school-2',
            name: 'Escola XPTO',
            email: 'contato@xpto.com',
            phone: '1199998888',
            cnpj: '55667788000111',
            createdAt: new Date('2024-01-01')
        });
        const course = Course.create({
            id: 'course-2',
            schoolId: school.id,
            name: 'Curso B',
            description: 'Descrição original',
            categories: [{ categoryId: 'infantil', subcategoryIds: ['alfabetizacao'] }],
            isActive: true,
            createdAt: new Date('2024-01-02')
        });
        const otherCourse = Course.create({
            id: 'course-3',
            schoolId: school.id,
            name: 'Curso C',
            description: null,
            categories: [],
            isActive: true,
            createdAt: new Date('2024-01-03')
        });
        schools.seed(school);
        courses.seed(course);
        courses.seed(otherCourse);

        const updateCourse = new UpdateCourse(schools, courses);

        const updated = await updateCourse.exec({
            schoolId: school.id,
            courseId: course.id,
            name: 'Curso B Atualizado',
            description: 'Nova descrição',
            categories: [{ categoryId: 'juvenil', subcategoryIds: [] }]
        });

        expect(updated.name).toBe('Curso B Atualizado');
        expect(updated.description).toBe('Nova descrição');
        expect(updated.categories).toEqual([{ categoryId: 'juvenil', subcategoryIds: [] }]);

        const stored = await courses.findById(course.id);
        expect(stored?.name).toBe('Curso B Atualizado');
        expect(stored?.description).toBe('Nova descrição');

        await expect(updateCourse.exec({
            schoolId: school.id,
            courseId: course.id,
            name: 'Curso C'
        })).rejects.toThrow('Course name already in use for this school');
    });

    it('lists courses for a school ordered by creation date', async () => {
        const courses = new InMemoryCourseRepository();
        const categories = new InMemoryCategoryRepository();
        categories.seed({
            id: 'infantil',
            name: 'Infantil',
            subcategories: [
                { id: 'criancas', name: 'Crianças' }
            ]
        });
        const listCourses = new ListSchoolCourses(courses, categories);

        const older = Course.create({
            id: 'course-old',
            schoolId: 'school-1',
            name: 'Curso Antigo',
            description: null,
            categories: [{ categoryId: 'infantil', subcategoryIds: ['criancas'] }],
            createdAt: new Date('2024-01-01')
        });
        const newer = Course.create({
            id: 'course-new',
            schoolId: 'school-1',
            name: 'Curso Novo',
            description: 'Descrição',
            categories: [],
            createdAt: new Date('2024-02-01')
        });

        courses.seed(older);
        courses.seed(newer);

        const result = await listCourses.exec({ schoolId: 'School-1' });
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('course-new');
        expect(result[1].id).toBe('course-old');
        expect(result[0].description).toBe('Descrição');
        expect(result[1].categories[0]).toEqual({
            id: 'infantil',
            name: 'Infantil',
            subcategories: [{ id: 'criancas', name: 'Crianças' }]
        });
    });

    it('retrieves a specific course when it belongs to the school', async () => {
        const courses = new InMemoryCourseRepository();
        const getCourse = new GetSchoolCourse(courses);

        const course = Course.create({
            id: 'course-unique',
            schoolId: 'school-unique',
            name: 'Curso Único',
            description: null,
            categories: [],
            createdAt: new Date('2024-03-01')
        });
        courses.seed(course);

        const found = await getCourse.exec({ schoolId: 'school-unique', courseId: course.id });
        expect(found).not.toBeNull();
        expect(found?.id).toBe(course.id);

        const missing = await getCourse.exec({ schoolId: 'other-school', courseId: course.id });
        expect(missing).toBeNull();
    });

    it('fetches full school profile with owner and addresses', async () => {
        const repo = new InMemorySchoolRepository();
        const getProfile = new GetSchoolProfile(repo);

        const address = PostalAddress.create({
            street: 'Rua das Flores',
            number: '100',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234-000',
            complement: 'Sala 2',
            district: 'Centro'
        });

        const school = School.create({
            id: 'school-profile',
            name: 'Escola Perfil',
            email: 'contato@perfil.com',
            phone: '11987654321',
            cnpj: '12.345.678/0001-99',
            addresses: [address],
            ownerUserId: 'owner-1',
            ownerName: 'Carlos Silva',
            ownerCpf: '123.456.789-00',
            ownerEmail: 'carlos@perfil.com',
            createdAt: new Date('2024-02-15')
        });
        repo.seed(school);

        const profile = await getProfile.exec({ schoolId: '  school-profile ' });
        expect(profile).not.toBeNull();
        expect(profile?.ownerEmail).toBe('carlos@perfil.com');
        expect(profile?.addresses).toHaveLength(1);
        expect(profile?.addresses[0]).toMatchObject({
            zipCode: '01234000',
            complement: 'Sala 2'
        });

        const missing = await getProfile.exec({ schoolId: 'unknown' });
        expect(missing).toBeNull();
    });

    it('updates a school profile keeping owner credentials when omitted', async () => {
        const repo = new InMemorySchoolRepository();
        const hasher = new TestPasswordHasher();
        const create = new CreateSchool(repo, hasher);
        const update = new UpdateSchool(repo, hasher);

        const created = await create.exec({
            name: 'Escola Perfil',
            email: 'contato@perfil.com',
            phone: '11987654321',
            cnpj: '12.345.678/0001-90',
            ownerName: 'Ana Silva',
            ownerCpf: '123.456.789-00',
            ownerEmail: 'ana@perfil.com',
            ownerPassword: 'senha-forte-123',
            addresses: [{
                street: 'Rua A',
                number: '123',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234-000'
            }]
        });

        const result = await update.exec({
            schoolId: created.id,
            name: '  Escola Perfil Atualizada  ',
            email: 'nova@perfil.com',
            phone: '(11) 90000-0000',
            cnpj: '12.345.678/0001-90',
            addresses: [{
                street: 'Rua B',
                number: '456',
                complement: 'Sala 2',
                district: 'Centro',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234-001'
            }],
            ownerName: 'Ana Silva',
            ownerCpf: '123.456.789-00',
            ownerEmail: 'ana@perfil.com'
        });

        expect(result.name).toBe('Escola Perfil Atualizada');
        expect(result.phone).toBe('11900000000');
        expect(result.addresses).toHaveLength(1);
        expect(result.addresses[0]).toMatchObject({
            street: 'Rua B',
            zipCode: '01234001',
            complement: 'Sala 2'
        });

        const stored = await repo.findById(created.id);
        expect(stored?.name).toBe('Escola Perfil Atualizada');
        expect(stored?.ownerPasswordHash).toBeTruthy();
    });

    it('removes owner information when explicitly cleared', async () => {
        const repo = new InMemorySchoolRepository();
        const hasher = new TestPasswordHasher();
        const create = new CreateSchool(repo, hasher);
        const update = new UpdateSchool(repo, hasher);

        const created = await create.exec({
            name: 'Escola Proprietário',
            email: 'contato@prop.com',
            phone: '11987654321',
            cnpj: '98.765.432/0001-10',
            ownerName: 'João Souza',
            ownerCpf: '987.654.321-00',
            ownerEmail: 'joao@prop.com',
            ownerPassword: 'senha-forte-456'
        });

        const result = await update.exec({
            schoolId: created.id,
            ownerName: null,
            ownerCpf: null,
            ownerEmail: null,
            ownerPassword: null,
            ownerUserId: null
        });

        expect(result.ownerName).toBeNull();
        expect(result.ownerEmail).toBeNull();

        const stored = await repo.findById(created.id);
        expect(stored?.ownerName).toBeNull();
        expect(stored?.ownerPasswordHash).toBeNull();
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
        const course = Course.create({
            id: 'course-1',
            schoolId: school.id,
            name: 'Curso A',
            description: null,
            categoryId: 'infantil',
            subcategoryId: 'alfabetizacao',
            isActive: true,
            createdAt: new Date('2024-01-02')
        });
        schools.seed(school);
        courses.seed(course);

        const useCase = new CreateCourseClass(courses, courseClasses);
        const result = await useCase.exec({
            schoolId: school.id,
            courseId: course.id,
            label: 'Turma A',
            capacity: 20,
            classes: [{ day: 'Segunda', start: '08:00', end: '09:00' }]
        });

        expect(result.courseId).toBe(course.id);
        expect(result.label).toBe('Turma A');

        await expect(useCase.exec({
            schoolId: school.id,
            courseId: course.id,
            label: 'Turma A',
            classes: [{ day: 'Segunda', start: '10:00', end: '11:00' }]
        })).rejects.toThrow('Class label already in use for this course');
        await expect(useCase.exec({
            schoolId: 'other-school',
            courseId: course.id,
            label: 'Turma B',
            classes: [{ day: 'Segunda', start: '10:00', end: '11:00' }]
        })).rejects.toThrow('Course not found for this school');
    });

    it('accepts school identifiers with different casing when creating a course class', async () => {
        const courses = new InMemoryCourseRepository();
        const courseClasses = new InMemoryCourseClassRepository();

        const course = Course.create({
            id: 'course-2',
            schoolId: 'school-2',
            name: 'Curso B',
            description: null,
            categoryId: 'infantil',
            subcategoryId: 'alfabetizacao',
            isActive: true,
            createdAt: new Date('2024-01-03')
        });
        courses.seed(course);

        const useCase = new CreateCourseClass(courses, courseClasses);
        const result = await useCase.exec({
            schoolId: 'SCHOOL-2',
            courseId: course.id,
            label: 'Turma B',
            classes: [{ day: 'Terça', start: '09:00', end: '10:00' }]
        });

        expect(result.courseId).toBe(course.id);
        expect(result.label).toBe('Turma B');
    });

    it('lists classes for a course when the school matches', async () => {
        const courses = new InMemoryCourseRepository();
        const courseClasses = new InMemoryCourseClassRepository();

        const course = Course.create({
            id: 'course-classes',
            schoolId: 'school-classes',
            name: 'Curso de Música',
            description: null,
            categories: [],
            createdAt: new Date('2024-01-10')
        });
        courses.seed(course);

        const older = CourseClass.create({
            id: 'class-old',
            courseId: course.id,
            label: 'Turma B',
            schedule: [{ day: 'Quarta', start: '14:00', end: '15:00' }],
            createdAt: new Date('2024-01-11')
        });
        const newer = CourseClass.create({
            id: 'class-new',
            courseId: course.id,
            label: 'Turma A',
            schedule: [{ day: 'Segunda', start: '08:00', end: '09:00' }],
            createdAt: new Date('2024-02-11')
        });
        courseClasses.seed(older);
        courseClasses.seed(newer);

        const listClasses = new ListCourseClasses(courses, courseClasses);

        const classes = await listClasses.exec({ schoolId: 'school-classes', courseId: course.id });
        expect(classes).not.toBeNull();
        if (!classes) throw new Error('Expected classes');
        expect(classes.map((cls) => cls.id)).toEqual(['class-new', 'class-old']);

        const unauthorized = await listClasses.exec({ schoolId: 'other-school', courseId: course.id });
        expect(unauthorized).toBeNull();
    });

    it('lists all classes for the school when no course filter is provided', async () => {
        const courses = new InMemoryCourseRepository();
        const courseClasses = new InMemoryCourseClassRepository();

        const courseA = Course.create({
            id: 'course-a',
            schoolId: 'school-classes',
            name: 'Curso de Teatro',
            description: null,
            categories: [],
            createdAt: new Date('2024-03-01')
        });
        const courseB = Course.create({
            id: 'course-b',
            schoolId: 'school-classes',
            name: 'Curso de Dança',
            description: null,
            categories: [],
            createdAt: new Date('2024-02-01')
        });
        courses.seed(courseA);
        courses.seed(courseB);

        const classA1 = CourseClass.create({
            id: 'class-a-1',
            courseId: courseA.id,
            label: 'Turma Teatro 1',
            schedule: [{ day: 'Segunda', start: '09:00', end: '10:00' }],
            createdAt: new Date('2024-04-01')
        });
        const classB1 = CourseClass.create({
            id: 'class-b-1',
            courseId: courseB.id,
            label: 'Turma Dança 1',
            schedule: [{ day: 'Terça', start: '11:00', end: '12:00' }],
            createdAt: new Date('2024-03-15')
        });
        const otherSchoolClass = CourseClass.create({
            id: 'class-other',
            courseId: 'different-course',
            label: 'Outra Escola',
            schedule: [{ day: 'Quarta', start: '14:00', end: '15:00' }],
            createdAt: new Date('2024-04-05')
        });

        courseClasses.seed(classA1);
        courseClasses.seed(classB1);
        courseClasses.seed(otherSchoolClass);

        const listClasses = new ListCourseClasses(courses, courseClasses);

        const classes = await listClasses.exec({ schoolId: 'school-classes' });
        expect(classes).not.toBeNull();
        if (!classes) throw new Error('Expected classes');
        expect(classes.map((cls) => cls.id)).toEqual(['class-a-1', 'class-b-1']);
    });

    it('retrieves a course class when it belongs to the school and course', async () => {
        const courses = new InMemoryCourseRepository();
        const courseClasses = new InMemoryCourseClassRepository();

        const course = Course.create({
            id: 'course-target',
            schoolId: 'school-target',
            name: 'Curso de Artes',
            description: null,
            categories: [],
            createdAt: new Date('2024-03-01')
        });
        courses.seed(course);

        const courseClass = CourseClass.create({
            id: 'class-target',
            courseId: course.id,
            label: 'Turma C',
            schedule: [{ day: 'Sexta', start: '16:00', end: '17:00' }],
            createdAt: new Date('2024-03-02')
        });
        courseClasses.seed(courseClass);

        const getClass = new GetCourseClass(courses, courseClasses);

        const found = await getClass.exec({ schoolId: ' school-target ', courseId: course.id, classId: courseClass.id });
        expect(found).not.toBeNull();
        expect(found?.label).toBe('Turma C');

        const missing = await getClass.exec({ schoolId: 'school-target', courseId: course.id, classId: 'unknown' });
        expect(missing).toBeNull();

        const wrongSchool = await getClass.exec({ schoolId: 'other-school', courseId: course.id, classId: courseClass.id });
        expect(wrongSchool).toBeNull();
    });

    it('logs in a school owner with valid credentials', async () => {
        const repo = new InMemorySchoolRepository();
        const hasher = new TestPasswordHasher();
        const tokens = new TestTokenProvider();
        const createSchool = new CreateSchool(repo, hasher);

        const created = await createSchool.exec({
            name: 'Colégio Login',
            email: 'contato@colegio.com',
            phone: '11987654321',
            cnpj: '12.345.678/0001-90',
            ownerName: 'Ana Silva',
            ownerCpf: '123.456.789-01',
            ownerEmail: 'ana@colegio.com',
            ownerPassword: 'senha-forte-123'
        });

        const login = new LoginSchool(repo, hasher, tokens, 3600);
        const result = await login.exec({ email: 'ana@colegio.com', password: 'senha-forte-123' });

        expect(result.schoolId).toBe(created.id);
        expect(result.ownerName).toBe('Ana Silva');
        expect(result.ownerEmail).toBe('ana@colegio.com');
        expect(result.accessToken).toBe(`token-${created.id}`);
        expect(result.expiresIn).toBe(3600);
    });

    it('rejects login with invalid credentials', async () => {
        const repo = new InMemorySchoolRepository();
        const hasher = new TestPasswordHasher();
        const tokens = new TestTokenProvider();
        const createSchool = new CreateSchool(repo, hasher);

        await createSchool.exec({
            name: 'Colégio Login 2',
            email: 'contato2@colegio.com',
            phone: '11987654321',
            cnpj: '12.345.678/0001-91',
            ownerName: 'Bruno Lima',
            ownerCpf: '123.456.789-02',
            ownerEmail: 'bruno@colegio.com',
            ownerPassword: 'senha-forte-123'
        });

        const login = new LoginSchool(repo, hasher, tokens, 3600);
        await expect(login.exec({ email: 'bruno@colegio.com', password: 'senha-errada' })).rejects.toThrow('Invalid credentials');
    });
});
