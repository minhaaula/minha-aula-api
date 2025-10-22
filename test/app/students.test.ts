import { describe, expect, it } from 'vitest';
import { ListStudents } from '../../src/app/use-cases/list-students';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../src/ports/repositories/enrollment.repo';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { Dependent } from '../../src/domain/entities/dependent';
import { CourseClass } from '../../src/domain/entities/course-class';
import { Enrollment } from '../../src/domain/entities/enrollment';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { Course } from '../../src/domain/entities/course';

class InMemoryUserRepository implements UserRepository {
    private readonly items = new Map<string, User>();
    private readonly membership = new Map<string, string>();

    async findByEmail(): Promise<User | null> {
        return null;
    }

    async findByCpf(cpf: string): Promise<User | null> {
        const normalized = cpf.replace(/\D/g, '');
        return Array.from(this.items.values()).find((user) => user.cpf === normalized) ?? null;
    }

    async findById(id: string): Promise<User | null> {
        return this.items.get(id) ?? null;
    }

    async findByPersona(persona: string): Promise<User[]> {
        return Array.from(this.items.values()).filter((user) => user.persona === persona);
    }

    async findBySchoolId(schoolId: string): Promise<User[]> {
        return Array.from(this.items.values()).filter((user) => this.membership.get(user.id) === schoolId);
    }

    async save(user: User): Promise<void> {
        this.items.set(user.id, user);
    }

    seed(user: User) {
        this.items.set(user.id, user);
    }

    assignStudentToSchool(studentId: string, schoolId: string) {
        this.membership.set(studentId, schoolId);
    }
}

class InMemoryDependentRepository implements DependentRepository {
    private readonly items = new Map<string, Dependent>();

    async findById(id: string): Promise<Dependent | null> {
        return this.items.get(id) ?? null;
    }

    async findByUserAndFullName(userId: string, fullName: string): Promise<Dependent | null> {
        return Array.from(this.items.values()).find((dep) => dep.userId === userId && dep.fullName === fullName.trim()) ?? null;
    }

    async findByUserIds(userIds: string[]): Promise<Dependent[]> {
        const allowed = new Set(userIds);
        return Array.from(this.items.values()).filter((dep) => allowed.has(dep.userId));
    }

    async save(dependent: Dependent): Promise<void> {
        this.items.set(dependent.id, dependent);
    }

    seed(dependent: Dependent) {
        this.items.set(dependent.id, dependent);
    }
}

class InMemoryCourseRepository implements CourseRepository {
    private readonly items = new Map<string, Course>();

    async findById(id: string): Promise<Course | null> {
        return this.items.get(id) ?? null;
    }

    async findByIdIncludingDeleted(id: string): Promise<Course | null> {
        return this.findById(id);
    }

    async findBySchoolAndName(schoolId: string, name: string): Promise<Course | null> {
        return Array.from(this.items.values()).find(
            (course) => course.schoolId === schoolId && course.name === name && course.isActive
        ) ?? null;
    }

    async findBySchoolId(schoolId: string): Promise<Course[]> {
        return Array.from(this.items.values()).filter(
            (course) => course.schoolId === schoolId && course.isActive
        );
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

    async findByCourseAndLabel(courseId: string, label: string): Promise<CourseClass | null> {
        return Array.from(this.items.values()).find((cls) => cls.courseId === courseId && cls.label === label) ?? null;
    }

    async findByCourseId(courseId: string): Promise<CourseClass[]> {
        return Array.from(this.items.values()).filter((cls) => cls.courseId === courseId);
    }

    async findByCourseIds(courseIds: string[]): Promise<CourseClass[]> {
        if (courseIds.length === 0) return [];
        const lookup = new Set(courseIds);
        return Array.from(this.items.values()).filter((cls) => lookup.has(cls.courseId));
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

    async findByClassAndUser(classId: string, userId: string): Promise<Enrollment | null> {
        return Array.from(this.items.values()).find((enrollment) => enrollment.courseClassId === classId && enrollment.studentUserId === userId) ?? null;
    }

    async findByClassAndDependent(classId: string, dependentId: string): Promise<Enrollment | null> {
        return Array.from(this.items.values()).find((enrollment) => enrollment.courseClassId === classId && enrollment.dependentId === dependentId) ?? null;
    }

    async findActiveByClassIds(classIds: string[]): Promise<Enrollment[]> {
        const lookup = new Set(classIds);
        return Array.from(this.items.values()).filter((enrollment) => lookup.has(enrollment.courseClassId) && enrollment.status === 'ACTIVE');
    }

    async save(enrollment: Enrollment): Promise<void> {
        this.items.set(enrollment.id, enrollment);
    }

    seed(enrollment: Enrollment) {
        this.items.set(enrollment.id, enrollment);
    }
}

const makeStudent = (id: string, cpf: string, createdAt: Date, fullName?: string) => User.create({
    id,
    fullName: fullName ?? `Estudante ${id}`,
    birthDate: new Date('2000-01-01'),
    email: Email.create(`${id}@example.com`),
    phone: '11999990000',
    cpf,
    address: PostalAddress.create({
        street: 'Rua Teste',
        number: '100',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234000'
    }),
    persona: 'STUDENT',
    passwordHash: 'hash',
    createdAt
});

const makeDependent = (id: string, userId: string, createdAt: Date) => Dependent.create({
    id,
    userId,
    fullName: `Dependente ${id}`,
    birthDate: null,
    relationship: 'Filho',
    createdAt
});

describe('ListStudents use case', () => {
    it('returns students with their dependents ordered by creation date', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        const newer = makeStudent('student-2', '12345678902', new Date('2024-01-01T10:00:00Z'));
        const older = makeStudent('student-1', '12345678901', new Date('2023-01-01T10:00:00Z'));
        users.seed(newer);
        users.seed(older);
        dependents.seed(makeDependent('dep-1', 'student-2', new Date('2024-02-01T10:00:00Z')));
        dependents.seed(makeDependent('dep-2', 'student-2', new Date('2024-03-01T10:00:00Z')));
        dependents.seed(makeDependent('dep-3', 'student-1', new Date('2023-02-01T10:00:00Z')));

        const useCase = new ListStudents(users, dependents, courses, classes, enrollments);
        const result = await useCase.exec();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('student-2');
        expect(result[0].dependents.map((dep) => dep.id)).toEqual(['dep-2', 'dep-1']);
        expect(result[1].id).toBe('student-1');
        expect(result[1].dependents).toHaveLength(1);
        expect(result[1].dependents[0].userId).toBe('student-1');
    });

    it('returns empty list when no students are registered', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        const useCase = new ListStudents(users, dependents, courses, classes, enrollments);

        const result = await useCase.exec();
        expect(result).toEqual([]);
    });

    it('filters by CPF when provided', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const studentA = makeStudent('student-1', '12345678901', new Date('2024-01-01T10:00:00Z'));
        const studentB = makeStudent('student-2', '12345678902', new Date('2024-02-01T10:00:00Z'));
        users.seed(studentA);
        users.seed(studentB);
        dependents.seed(makeDependent('dep-1', studentA.id, new Date('2024-03-01T10:00:00Z')));
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();

        const useCase = new ListStudents(users, dependents, courses, classes, enrollments);
        const result = await useCase.exec({ cpf: '123.456.789-01' });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(studentA.id);
        expect(result[0].dependents).toHaveLength(1);
        expect(result[0].dependents[0].id).toBe('dep-1');
    });

    it('returns empty array when CPF belongs to a non-student user', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        const nonStudent = User.create({
            id: 'user-1',
            fullName: 'Usuário comum',
            birthDate: new Date('1990-01-01'),
            email: Email.create('user@example.com'),
            phone: '11988887777',
            cpf: '12345678903',
            address: PostalAddress.create({
                street: 'Rua Teste',
                number: '50',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234000'
            }),
            persona: 'SCHOOL',
            passwordHash: 'hash',
            createdAt: new Date('2024-01-01T10:00:00Z')
        });
        users.seed(nonStudent);

        const useCase = new ListStudents(users, dependents, courses, classes, enrollments);
        const result = await useCase.exec({ cpf: '12345678903' });

        expect(result).toHaveLength(0);
    });

    it('throws when CPF format is invalid', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        const useCase = new ListStudents(users, dependents, courses, classes, enrollments);

        await expect(useCase.exec({ cpf: '123' })).rejects.toThrow('Invalid CPF');
    });

    it('filters students by school when schoolId is provided', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const studentA = makeStudent('student-1', '12345678901', new Date('2024-01-01T10:00:00Z'));
        const studentB = makeStudent('student-2', '12345678902', new Date('2024-02-01T10:00:00Z'));
        users.seed(studentA);
        users.seed(studentB);
        users.assignStudentToSchool(studentA.id, 'school-1');
        users.assignStudentToSchool(studentB.id, 'school-2');
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();

        const useCase = new ListStudents(users, dependents, courses, classes, enrollments);
        const result = await useCase.exec({ schoolId: 'school-1' });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(studentA.id);
    });

    it('filters students by name fragment', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        const studentA = makeStudent('student-1', '12345678901', new Date('2024-01-01T10:00:00Z'));
        const studentB = makeStudent('student-2', '12345678902', new Date('2024-02-01T10:00:00Z'), 'Outro Nome');
        users.seed(studentA);
        users.seed(studentB);

        const useCase = new ListStudents(users, dependents, courses, classes, enrollments);
        const result = await useCase.exec({ name: 'estudante' });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('student-1');
    });

    it('filters students by course enrollment', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        const studentA = makeStudent('student-1', '12345678901', new Date('2024-01-01T10:00:00Z'));
        const studentB = makeStudent('student-2', '12345678902', new Date('2024-02-01T10:00:00Z'));
        users.seed(studentA);
        users.seed(studentB);

        const classForCourse = CourseClass.create({
            id: 'class-1',
            courseId: 'course-1',
            label: 'Turma A',
            schedule: [{ day: 'Segunda', start: '08:00', end: '09:00' }]
        });
        classes.seed(classForCourse);
        enrollments.seed(Enrollment.createForUser({
            id: 'enroll-1',
            courseClassId: classForCourse.id,
            ownerUserId: studentA.id,
            studentUserId: studentA.id
        }));

        const useCase = new ListStudents(users, dependents, courses, classes, enrollments);
        const result = await useCase.exec({ courseId: 'course-1' });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(studentA.id);
    });

    it('enriches students with school context including courses, classes and categories', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const enrollments = new InMemoryEnrollmentRepository();

        const student = makeStudent('student-1', '12345678901', new Date('2024-01-01T10:00:00Z'));
        users.seed(student);
        users.assignStudentToSchool(student.id, 'school-1');

        const course = Course.create({
            id: 'course-1',
            schoolId: 'school-1',
            name: 'Curso de Inglês',
            description: null,
            categories: [
                { categoryId: 'cat-1', subcategoryIds: ['sub-1'] },
                { categoryId: 'cat-2', subcategoryIds: [] }
            ],
            createdAt: new Date('2024-01-05T10:00:00Z')
        });
        courses.seed(course);

        const courseClass = CourseClass.create({
            id: 'class-1',
            courseId: course.id,
            label: 'Turma A',
            schedule: [{ day: 'Segunda', start: '08:00', end: '09:00' }]
        });
        classes.seed(courseClass);

        enrollments.seed(Enrollment.createForUser({
            id: 'enroll-1',
            courseClassId: courseClass.id,
            ownerUserId: student.id,
            studentUserId: student.id
        }));

        const useCase = new ListStudents(users, dependents, courses, classes, enrollments);
        const result = await useCase.exec({ schoolId: 'school-1' });

        expect(result).toHaveLength(1);
        const [summary] = result;
        expect(summary.schoolContext).toEqual({
            schoolId: 'school-1',
            courses: [{ id: course.id, name: course.name }],
            classes: [{ id: courseClass.id, label: courseClass.label, courseId: course.id }],
            categories: [
                { categoryId: 'cat-1', subcategoryIds: ['sub-1'] },
                { categoryId: 'cat-2', subcategoryIds: [] }
            ]
        });
    });
});
