import { describe, expect, it } from 'vitest';
import { CreateEnrollmentRequest } from '../../src/app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from '../../src/app/use-cases/approve-enrollment-request';
import { ListEnrollmentRequests } from '../../src/app/use-cases/list-enrollment-requests';
import { GetEnrollmentRequest } from '../../src/app/use-cases/get-enrollment-request';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../src/ports/repositories/enrollment.repo';
import { EnrollmentRequestRepository } from '../../src/ports/repositories/enrollment-request.repo';
import { School } from '../../src/domain/entities/school';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { Dependent } from '../../src/domain/entities/dependent';
import { Enrollment } from '../../src/domain/entities/enrollment';
import { EnrollmentRequest, EnrollmentRequestStatus } from '../../src/domain/entities/enrollment-request';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';

class InMemorySchools implements SchoolRepository {
    private readonly items = new Map<string, School>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByEmail(email: string) {
        const normalized = email.trim().toLowerCase();
        if (!normalized) return null;
        return Array.from(this.items.values()).find((item) => item.email === normalized) ?? null;
    }
    async findByOwnerUserId(userId: string) {
        const normalized = userId.trim();
        if (!normalized) return null;
        return Array.from(this.items.values()).find((item) => item.ownerUserId === normalized) ?? null;
    }
    async findAll() { return Array.from(this.items.values()); }
    async save(school: School) { this.items.set(school.id, school); }
    seed(school: School) { this.items.set(school.id, school); }
}

class InMemoryCourses implements CourseRepository {
    private readonly items = new Map<string, Course>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findBySchoolAndName(schoolId: string, name: string) {
        return Array.from(this.items.values()).find((course) => course.schoolId === schoolId && course.name === name.trim()) ?? null;
    }
    async findBySchoolId(schoolId: string) {
        return Array.from(this.items.values())
            .filter((course) => course.schoolId === schoolId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async save(course: Course) { this.items.set(course.id, course); }
    seed(course: Course) { this.items.set(course.id, course); }
}

class InMemoryClasses implements CourseClassRepository {
    private readonly items = new Map<string, CourseClass>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByCourseAndLabel(courseId: string, label: string) {
        return Array.from(this.items.values()).find((cls) => cls.courseId === courseId && cls.label === label) ?? null;
    }
    async findByCourseId(courseId: string) {
        return Array.from(this.items.values())
            .filter((cls) => cls.courseId === courseId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async save(cls: CourseClass) { this.items.set(cls.id, cls); }
    seed(cls: CourseClass) { this.items.set(cls.id, cls); }
}

class InMemoryUsers implements UserRepository {
    private readonly items = new Map<string, User>();
    async findByEmail() { return null; }
    async findByCpf() { return null; }
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByPersona(persona: string) {
        return Array.from(this.items.values()).filter((user) => user.persona === persona);
    }
    async save(user: User) { this.items.set(user.id, user); }
    seed(user: User) { this.items.set(user.id, user); }
}

class InMemoryDependents implements DependentRepository {
    private readonly items = new Map<string, Dependent>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByUserAndFullName(userId: string, fullName: string) {
        return Array.from(this.items.values()).find((dep) => dep.userId === userId && dep.fullName === fullName.trim()) ?? null;
    }
    async findByUserIds(userIds: string[]) {
        const set = new Set(userIds);
        return Array.from(this.items.values()).filter((dep) => set.has(dep.userId));
    }
    async save(dep: Dependent) { this.items.set(dep.id, dep); }
    seed(dep: Dependent) { this.items.set(dep.id, dep); }
}

class InMemoryEnrollments implements EnrollmentRepository {
    private readonly items = new Map<string, Enrollment>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByClassAndUser(classId: string, userId: string) {
        return Array.from(this.items.values()).find((enrollment) => enrollment.courseClassId === classId && enrollment.studentUserId === userId) ?? null;
    }
    async findByClassAndDependent(classId: string, dependentId: string) {
        return Array.from(this.items.values()).find((enrollment) => enrollment.courseClassId === classId && enrollment.dependentId === dependentId) ?? null;
    }
    async findActiveByClassIds(classIds: string[]): Promise<Enrollment[]> {
        const lookup = new Set(classIds);
        return Array.from(this.items.values()).filter((enrollment) => lookup.has(enrollment.courseClassId) && enrollment.status === 'ACTIVE');
    }
    async save(enrollment: Enrollment) { this.items.set(enrollment.id, enrollment); }
    all() { return Array.from(this.items.values()); }
    seed(enrollment: Enrollment) { this.items.set(enrollment.id, enrollment); }
}

class InMemoryRequests implements EnrollmentRequestRepository {
    private readonly items = new Map<string, EnrollmentRequest>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByCourseClassAndTarget(params: { courseClassId: string; userId: string; dependentId: string | null; }) {
        return Array.from(this.items.values()).find((request) =>
            request.courseClassId === params.courseClassId &&
            request.requestedForUserId === params.userId &&
            request.requestedForDependentId === params.dependentId
        ) ?? null;
    }
    async findMany(params: {
        schoolId?: string;
        courseClassId?: string;
        status?: EnrollmentRequestStatus;
        requestedForUserId?: string;
        requestedForDependentId?: string | null;
        limit?: number;
        offset?: number;
    }) {
        const filtered = Array.from(this.items.values()).filter((request) => {
            if (params.schoolId && request.schoolId !== params.schoolId) return false;
            if (params.courseClassId && request.courseClassId !== params.courseClassId) return false;
            if (params.status && request.status !== params.status) return false;
            if (params.requestedForUserId && request.requestedForUserId !== params.requestedForUserId) return false;
            if (params.requestedForDependentId === null && request.requestedForDependentId !== null) return false;
            if (params.requestedForDependentId && request.requestedForDependentId !== params.requestedForDependentId) return false;
            return true;
        });
        const ordered = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const offset = params.offset ?? 0;
        const limit = params.limit ?? ordered.length;
        return ordered.slice(offset, offset + limit);
    }
    async save(request: EnrollmentRequest) { this.items.set(request.id, request); }
    seed(request: EnrollmentRequest) { this.items.set(request.id, request); }
}

let cpfCounter = 0;

const makeUser = (id: string) => User.create({
    id,
    fullName: 'Usuário ' + id,
    birthDate: new Date('1990-01-01'),
    email: Email.create(`${id}@example.com`),
    phone: '1199999999',
    cpf: `${++cpfCounter}`.padStart(11, '0'),
    address: PostalAddress.create({
        street: 'Rua A',
        number: '123',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234000'
    }),
    persona: 'STUDENT',
    passwordHash: 'hash'
});

const setupCourseStructure = () => {
    const school = School.create({
        id: 'school-1',
        name: 'Escola 1',
        email: 'contato@escola1.com',
        phone: '11988887777',
        cnpj: '00987654000100',
        createdAt: new Date('2024-01-01')
    });
    const course = Course.create({
        id: 'course-1',
        schoolId: school.id,
        name: 'Curso 1',
        description: null,
        categoryId: 'infantil',
        subcategoryId: 'alfabetizacao',
        isActive: true,
        createdAt: new Date('2024-01-02')
    });
    const courseClass = CourseClass.create({
        id: 'class-1',
        courseId: course.id,
        label: 'Turma A',
        capacity: 10,
        schedule: [{ day: 'Segunda', start: '08:00', end: '09:00' }]
    });
    return { school, course, courseClass };
};

describe('CreateEnrollmentRequest', () => {
    it('creates a request for the user themselves', async () => {
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();
        const classes = new InMemoryClasses();
        const users = new InMemoryUsers();
        const dependents = new InMemoryDependents();
        const enrollments = new InMemoryEnrollments();
        const requests = new InMemoryRequests();

        const { school, course, courseClass } = setupCourseStructure();
        schools.seed(school);
        courses.seed(course);
        classes.seed(courseClass);
        const user = makeUser('user-1');
        users.seed(user);

        const useCase = new CreateEnrollmentRequest(schools, courses, classes, users, dependents, enrollments, requests);
        const result = await useCase.exec({
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            notes: 'Quero participar'
        });

        expect(result.status).toBe('PENDING');
        expect(result.requestedForDependentId).toBeNull();
    });

    it('prevents duplicate enrollment requests and validations for dependents', async () => {
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();
        const classes = new InMemoryClasses();
        const users = new InMemoryUsers();
        const dependents = new InMemoryDependents();
        const enrollments = new InMemoryEnrollments();
        const requests = new InMemoryRequests();

        const { school, course, courseClass } = setupCourseStructure();
        schools.seed(school);
        courses.seed(course);
        classes.seed(courseClass);
        const user = makeUser('user-2');
        users.seed(user);
        const dependent = Dependent.create({ id: 'dep-1', userId: user.id, fullName: 'Criança', birthDate: null });
        dependents.seed(dependent);

        const useCase = new CreateEnrollmentRequest(schools, courses, classes, users, dependents, enrollments, requests);
        await useCase.exec({
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            requestedForDependentId: dependent.id
        });

        await expect(useCase.exec({
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            requestedForDependentId: dependent.id
        })).rejects.toThrow('Enrollment request already exists for this target');

        enrollments.seed(Enrollment.createForDependent({
            id: 'enroll-1',
            courseClassId: courseClass.id,
            ownerUserId: user.id,
            dependentId: dependent.id
        }));

        await expect(useCase.exec({
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            requestedForDependentId: dependent.id
        })).rejects.toThrow('Dependent already enrolled in this class');
    });
});

describe('ApproveEnrollmentRequest', () => {
    it('approves request for the user and creates enrollment', async () => {
        const enrollments = new InMemoryEnrollments();
        const requests = new InMemoryRequests();
        const request = EnrollmentRequest.create({
            id: 'req-1',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'user-1'
        });
        requests.seed(request);

        const useCase = new ApproveEnrollmentRequest(requests, enrollments);
        const result = await useCase.exec({ requestId: request.id, approverUserId: 'user-1' });

        expect(result.status).toBe('APPROVED');
        expect(enrollments.all()).toHaveLength(1);
        expect(enrollments.all()[0].studentUserId).toBe('user-1');
    });

    it('validates ownership and existing enrollments', async () => {
        const enrollments = new InMemoryEnrollments();
        const requests = new InMemoryRequests();
        const request = EnrollmentRequest.create({
            id: 'req-2',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'owner',
            requestedForDependentId: 'dep-1'
        });
        requests.seed(request);

        const useCase = new ApproveEnrollmentRequest(requests, enrollments);
        await expect(useCase.exec({ requestId: 'missing', approverUserId: 'owner' })).rejects.toThrow('Enrollment request not found');
        await expect(useCase.exec({ requestId: request.id, approverUserId: 'other' })).rejects.toThrow('User not allowed to approve this enrollment request');

        enrollments.seed(Enrollment.createForDependent({
            id: 'enroll-existing',
            courseClassId: 'class-1',
            ownerUserId: 'owner',
            dependentId: 'dep-1'
        }));

        await expect(useCase.exec({ requestId: request.id, approverUserId: 'owner' })).rejects.toThrow('Dependent already enrolled in this class');

        (request as any)._status = 'APPROVED';
        await expect(useCase.exec({ requestId: request.id, approverUserId: 'owner' })).rejects.toThrow('Enrollment request already decided');
    });
});

describe('ListEnrollmentRequests', () => {
    it('filters by class, status and dependent', async () => {
        const requests = new InMemoryRequests();
        const first = EnrollmentRequest.create({
            id: 'req-1',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'user-1',
            createdAt: new Date('2024-01-01T10:00:00Z')
        });
        const second = EnrollmentRequest.create({
            id: 'req-2',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'user-1',
            requestedForDependentId: 'dep-1',
            createdAt: new Date('2024-02-01T10:00:00Z')
        });
        (second as any)._status = 'APPROVED';
        const other = EnrollmentRequest.create({
            id: 'req-3',
            schoolId: 'school-2',
            courseClassId: 'class-2',
            requestedForUserId: 'user-2',
            createdAt: new Date('2024-03-01T10:00:00Z')
        });

        requests.seed(first);
        requests.seed(second);
        requests.seed(other);

        const useCase = new ListEnrollmentRequests(requests);
        const items = await useCase.exec({ schoolId: 'school-1', courseClassId: 'class-1' });
        expect(items.map(({ id }) => id)).toEqual(['req-2', 'req-1']);

        const approvedOnly = await useCase.exec({ schoolId: 'school-1', courseClassId: 'class-1', status: 'APPROVED' });
        expect(approvedOnly).toHaveLength(1);
        expect(approvedOnly[0].id).toBe('req-2');

        const withoutDependent = await useCase.exec({ schoolId: 'school-1', courseClassId: 'class-1', requestedForDependentId: null });
        expect(withoutDependent).toHaveLength(1);
        expect(withoutDependent[0].id).toBe('req-1');
    });

    it('lists requests for a school without class filter', async () => {
        const requests = new InMemoryRequests();
        const first = EnrollmentRequest.create({
            id: 'req-10',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'user-1'
        });
        const second = EnrollmentRequest.create({
            id: 'req-11',
            schoolId: 'school-1',
            courseClassId: 'class-2',
            requestedForUserId: 'user-2'
        });
        const other = EnrollmentRequest.create({
            id: 'req-12',
            schoolId: 'school-2',
            courseClassId: 'class-3',
            requestedForUserId: 'user-3'
        });
        requests.seed(first);
        requests.seed(second);
        requests.seed(other);

        const useCase = new ListEnrollmentRequests(requests);
        const result = await useCase.exec({ schoolId: 'school-1' });
        expect(result.map(({ id }) => id).sort()).toEqual(['req-10', 'req-11']);
    });
});

describe('GetEnrollmentRequest', () => {
    it('returns the request when it exists', async () => {
        const requests = new InMemoryRequests();
        const request = EnrollmentRequest.create({
            id: 'req-10',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'user-1'
        });
        requests.seed(request);

        const useCase = new GetEnrollmentRequest(requests);
        const found = await useCase.exec({ requestId: request.id });
        expect(found).not.toBeNull();
        expect(found?.id).toBe(request.id);

        const missing = await useCase.exec({ requestId: 'missing-id' });
        expect(missing).toBeNull();
    });
});
