import { describe, expect, it } from 'vitest';
import { EnrollStudent } from '../../src/app/use-cases/enroll-student';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../src/ports/repositories/enrollment.repo';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { Dependent } from '../../src/domain/entities/dependent';
import { Enrollment } from '../../src/domain/entities/enrollment';

class InMemoryCourseRepository implements CourseRepository {
    private readonly items = new Map<string, Course>();
    async findById(id: string): Promise<Course | null> {
        return this.items.get(id) ?? null;
    }
    async findBySchoolAndName(): Promise<Course | null> {
        return null;
    }
    async findBySchoolId(): Promise<Course[]> {
        return [];
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
    async save(courseClass: CourseClass): Promise<void> {
        this.items.set(courseClass.id, courseClass);
    }
    seed(courseClass: CourseClass) {
        this.items.set(courseClass.id, courseClass);
    }
}

class InMemoryUserRepository implements UserRepository {
    private readonly items = new Map<string, User>();
    async findByEmail(): Promise<User | null> {
        return null;
    }
    async findByCpf(): Promise<User | null> {
        return null;
    }
    async findById(id: string): Promise<User | null> {
        return this.items.get(id) ?? null;
    }
    async findByPersona(): Promise<User[]> {
        return Array.from(this.items.values());
    }
    async findBySchoolId(): Promise<User[]> {
        return [];
    }
    async save(user: User): Promise<void> {
        this.items.set(user.id, user);
    }
    seed(user: User) {
        this.items.set(user.id, user);
    }
}

class InMemoryDependentRepository implements DependentRepository {
    private readonly items = new Map<string, Dependent>();
    async findById(id: string): Promise<Dependent | null> {
        return this.items.get(id) ?? null;
    }
    async findByUserAndFullName(): Promise<Dependent | null> {
        return null;
    }
    async findByUserIds(userIds: string[]): Promise<Dependent[]> {
        const set = new Set(userIds);
        return Array.from(this.items.values()).filter((dep) => set.has(dep.userId));
    }
    async save(dependent: Dependent): Promise<void> {
        this.items.set(dependent.id, dependent);
    }
    seed(dependent: Dependent) {
        this.items.set(dependent.id, dependent);
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
    all() {
        return Array.from(this.items.values());
    }
    seed(enrollment: Enrollment) {
        this.items.set(enrollment.id, enrollment);
    }
}

let cpfCounter = 0;

const makeStudent = (id: string, name: string) => User.create({
    id,
    fullName: name,
    birthDate: new Date('2000-01-01'),
    email: Email.create(`${id}@example.com`),
    phone: '11999999999',
    cpf: `${++cpfCounter}`.padStart(11, '0'),
    address: PostalAddress.create({
        street: 'Rua A',
        number: '10',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234000'
    }),
    persona: 'STUDENT',
    passwordHash: 'hash',
    createdAt: new Date('2024-01-01T00:00:00Z')
});

const makeCourse = () => Course.create({
    id: 'course-1',
    schoolId: 'school-1',
    name: 'Curso Teste'
});

const makeClass = () => CourseClass.create({
    id: 'class-1',
    courseId: 'course-1',
    label: 'Turma A',
    schedule: [{ day: 'Segunda', start: '08:00', end: '09:00' }]
});

describe('EnrollStudent use case', () => {
    it('enrolls a student user into a class', async () => {
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        courses.seed(makeCourse());
        classes.seed(makeClass());
        const student = makeStudent('student-1', 'Aluno Teste');
        users.seed(student);

        const useCase = new EnrollStudent(courses, classes, users, dependents, enrollments);
        const result = await useCase.exec({
            schoolId: 'school-1',
            courseId: 'course-1',
            classId: 'class-1',
            studentUserId: student.id
        });

        expect(result.studentType).toBe('USER');
        expect(result.studentUserId).toBe(student.id);
        expect(enrollments.all()).toHaveLength(1);
    });

    it('enrolls a dependent when provided', async () => {
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        courses.seed(makeCourse());
        classes.seed(makeClass());
        const owner = makeStudent('student-2', 'Responsável');
        users.seed(owner);
        const dependent = Dependent.create({ id: 'dep-1', userId: owner.id, fullName: 'Dependente', birthDate: null });
        dependents.seed(dependent);

        const useCase = new EnrollStudent(courses, classes, users, dependents, enrollments);
        const result = await useCase.exec({
            schoolId: 'school-1',
            courseId: 'course-1',
            classId: 'class-1',
            studentUserId: owner.id,
            dependentId: dependent.id
        });

        expect(result.studentType).toBe('DEPENDENT');
        expect(result.dependentId).toBe(dependent.id);
        expect(enrollments.all()).toHaveLength(1);
    });

    it('prevents duplicate enrollments for the same user', async () => {
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        courses.seed(makeCourse());
        classes.seed(makeClass());
        const student = makeStudent('student-3', 'Aluno');
        users.seed(student);
        enrollments.seed(Enrollment.createForUser({
            id: 'existing',
            courseClassId: 'class-1',
            ownerUserId: student.id,
            studentUserId: student.id
        }));

        const useCase = new EnrollStudent(courses, classes, users, dependents, enrollments);
        await expect(useCase.exec({
            schoolId: 'school-1',
            courseId: 'course-1',
            classId: 'class-1',
            studentUserId: student.id
        })).rejects.toThrow('Student already enrolled in this class');
    });

    it('validates course ownership for the school', async () => {
        const courses = new InMemoryCourseRepository();
        const classes = new InMemoryCourseClassRepository();
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const enrollments = new InMemoryEnrollmentRepository();
        courses.seed(makeCourse());
        classes.seed(makeClass());
        const student = makeStudent('student-4', 'Aluno');
        users.seed(student);

        const useCase = new EnrollStudent(courses, classes, users, dependents, enrollments);
        await expect(useCase.exec({
            schoolId: 'other-school',
            courseId: 'course-1',
            classId: 'class-1',
            studentUserId: student.id
        })).rejects.toThrow('Course not found for this school');
    });
});
