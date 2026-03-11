import { describe, expect, it } from 'vitest';
import { CreateEnrollmentRequest } from '../../src/app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from '../../src/app/use-cases/approve-enrollment-request';
import { ListEnrollmentRequests } from '../../src/app/use-cases/list-enrollment-requests';
import { GetEnrollmentRequest } from '../../src/app/use-cases/get-enrollment-request';
import { IssueEnrollmentFeeBoleto } from '../../src/app/use-cases/issue-enrollment-fee-boleto';
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
import { SchoolFinancialChargeRepository } from '../../src/ports/repositories/school-financial-charge.repo';
import { SchoolFinancialCharge } from '../../src/domain/entities/school-financial-charge';
import { PaymentProviderPort, CreateBoletoChargeInput } from '../../src/ports/providers/payment-provider.port';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';

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
    async findByCpf(cpf: string) {
        const normalized = cpf.replace(/\D/g, '');
        return Array.from(this.items.values()).find((dep) => dep.cpf === normalized) ?? null;
    }
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
    private readonly classCourseLookup = new Map<string, string>();
    private readonly studentDocuments = new Map<string, string>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByCourseClassAndTarget(params: { courseClassId: string; userId: string; dependentId: string | null; }) {
        const blockingStatuses: EnrollmentRequestStatus[] = ['PENDING', 'APPROVED'];
        return Array.from(this.items.values()).find((request) =>
            request.courseClassId === params.courseClassId &&
            request.requestedForUserId === params.userId &&
            request.requestedForDependentId === params.dependentId &&
            blockingStatuses.includes(request.status)
        ) ?? null;
    }
    async findMany(params: {
        schoolId?: string;
        courseClassId?: string;
        courseId?: string;
        status?: EnrollmentRequestStatus;
        statusIn?: EnrollmentRequestStatus[];
        requestedForUserId?: string;
        requestedForDependentId?: string | null;
        studentDocument?: string;
        limit?: number;
        offset?: number;
    }) {
        const filtered = Array.from(this.items.values()).filter((request) => {
            if (params.schoolId && request.schoolId !== params.schoolId) return false;
            if (params.courseClassId && request.courseClassId !== params.courseClassId) return false;
            if (params.courseId) {
                const courseId = this.classCourseLookup.get(request.courseClassId);
                if (courseId !== params.courseId) return false;
            }
            if (params.statusIn?.length) {
                if (!params.statusIn.includes(request.status)) return false;
            } else if (params.status && request.status !== params.status) return false;
            if (params.requestedForUserId && request.requestedForUserId !== params.requestedForUserId) return false;
            if (params.requestedForDependentId === null && request.requestedForDependentId !== null) return false;
            if (params.requestedForDependentId && request.requestedForDependentId !== params.requestedForDependentId) return false;
            if (params.studentDocument) {
                const doc = this.studentDocuments.get(request.id);
                if (doc !== params.studentDocument) return false;
            }
            return true;
        });
        const ordered = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const offset = params.offset ?? 0;
        const limit = params.limit ?? ordered.length;
        return ordered.slice(offset, offset + limit);
    }
    async save(request: EnrollmentRequest) { this.items.set(request.id, request); }
    seed(request: EnrollmentRequest) { this.items.set(request.id, request); }
    setCourseForClass(classId: string, courseId: string) { this.classCourseLookup.set(classId, courseId); }
    setStudentDocument(requestId: string, document: string) { this.studentDocuments.set(requestId, document); }
}

class InMemoryCharges implements SchoolFinancialChargeRepository {
    private readonly items = new Map<string, SchoolFinancialCharge>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async save(charge: SchoolFinancialCharge) { this.items.set(charge.id, charge); }
    all() { return Array.from(this.items.values()); }
}

class FakePaymentProvider implements PaymentProviderPort {
    callCount = 0;
    lastInput: CreateBoletoChargeInput | null = null;

    constructor(private readonly response: {
        providerRef: string;
        boletoUrl?: string | null;
        digitableLine?: string | null;
        barcode?: string | null;
        dueDate: Date;
    }) {}

    async authorize() { throw new Error('Not implemented'); }
    async capture() { throw new Error('Not implemented'); }

    async createBoletoCharge(input: CreateBoletoChargeInput) {
        this.callCount += 1;
        this.lastInput = input;
        return {
            providerRef: this.response.providerRef,
            boletoUrl: this.response.boletoUrl ?? undefined,
            digitableLine: this.response.digitableLine ?? undefined,
            barcode: this.response.barcode ?? undefined,
            dueDate: this.response.dueDate
        };
    }
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
            notes: 'Quero participar',
            firstMonthlyPaymentDate: '2024-02-01'
        });

        expect(result.status).toBe('PENDING');
        expect(result.requestedForDependentId).toBeNull();
    });

    it('stores discount value when provided', async () => {
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
            discount: 150.75,
            discountMonths: 1,
            firstMonthlyPaymentDate: '2024-02-01'
        });

        expect(result.discountCents).toBe(15075);
    });

    it('stores enrollment fee metadata when provided', async () => {
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
            enrollmentFeeAmount: 250,
            enrollmentFeeDueDate: '2024-01-15',
            firstMonthlyPaymentDate: '2024-02-01'
        });

        expect(result.enrollmentFeeCents).toBe(25000);
        expect(result.enrollmentFeeDueDate?.toISOString().slice(0, 10)).toBe('2024-01-15');
        expect(result.firstMonthlyPaymentDate.toISOString().slice(0, 10)).toBe('2024-02-01');
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
            requestedForDependentId: dependent.id,
            firstMonthlyPaymentDate: '2024-02-01'
        });

        await expect(useCase.exec({
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            requestedForDependentId: dependent.id,
            firstMonthlyPaymentDate: '2024-02-01'
        })).rejects.toThrow('Solicitação de matrícula já existe para este alvo');

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
            requestedForDependentId: dependent.id,
            firstMonthlyPaymentDate: '2024-02-01'
        })).rejects.toThrow('Já matriculado nesta turma');
    });

    it('allows new request when previous request was cancelled', async () => {
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
        const user = makeUser('user-3');
        users.seed(user);

        const cancelledRequest = EnrollmentRequest.create({
            id: 'req-cancelled',
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            firstMonthlyPaymentDate: new Date('2024-02-01')
        });
        (cancelledRequest as any)._status = 'CANCELLED';
        requests.seed(cancelledRequest);

        const useCase = new CreateEnrollmentRequest(schools, courses, classes, users, dependents, enrollments, requests);
        const result = await useCase.exec({
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            firstMonthlyPaymentDate: '2024-03-01'
        });

        expect(result.status).toBe('PENDING');
        expect(result.id).not.toBe(cancelledRequest.id);
    });
});

describe('ApproveEnrollmentRequest', () => {
    it('approves request for the user and creates enrollment', async () => {
        const enrollments = new InMemoryEnrollments();
        const requests = new InMemoryRequests();
        const classes = new InMemoryClasses();
        const courses = new InMemoryCourses();
        const charges = new InMemoryCharges();
        const { course, courseClass } = setupCourseStructure();
        classes.seed(courseClass);
        courses.seed(course);
        const request = EnrollmentRequest.create({
            id: 'req-1',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'user-1',
            firstMonthlyPaymentDate: new Date('2024-02-01')
        });
        requests.seed(request);

        const useCase = new ApproveEnrollmentRequest(requests, enrollments, classes, courses, charges);
        const result = await useCase.exec({ requestId: request.id, approverUserId: 'user-1' });

        expect(result.status).toBe('APPROVED');
        expect(result.enrollmentFeeChargeId).toBeNull();
        expect(enrollments.all()).toHaveLength(1);
        expect(enrollments.all()[0].studentUserId).toBe('user-1');
        expect(charges.all()).toHaveLength(0);
    });

    it('validates ownership and existing enrollments', async () => {
        const enrollments = new InMemoryEnrollments();
        const requests = new InMemoryRequests();
        const classes = new InMemoryClasses();
        const courses = new InMemoryCourses();
        const charges = new InMemoryCharges();
        const { course, courseClass } = setupCourseStructure();
        classes.seed(courseClass);
        courses.seed(course);
        const request = EnrollmentRequest.create({
            id: 'req-2',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'owner',
            requestedForDependentId: 'dep-1',
            firstMonthlyPaymentDate: new Date('2024-02-01')
        });
        requests.seed(request);

        const useCase = new ApproveEnrollmentRequest(requests, enrollments, classes, courses, charges);
        await expect(useCase.exec({ requestId: 'missing', approverUserId: 'owner' })).rejects.toThrow('Solicitação de matrícula não encontrada');
        await expect(useCase.exec({ requestId: request.id, approverUserId: 'other' })).rejects.toThrow('Operação não permitida');

        enrollments.seed(Enrollment.createForDependent({
            id: 'enroll-existing',
            courseClassId: 'class-1',
            ownerUserId: 'owner',
            dependentId: 'dep-1'
        }));

        await expect(useCase.exec({ requestId: request.id, approverUserId: 'owner' })).rejects.toThrow('Já matriculado nesta turma');

        (request as any)._status = 'APPROVED';
        await expect(useCase.exec({ requestId: request.id, approverUserId: 'owner' })).rejects.toThrow('Solicitação de matrícula já foi decidida');
    });

    it('creates enrollment charge when fee metadata is present', async () => {
        const enrollments = new InMemoryEnrollments();
        const requests = new InMemoryRequests();
        const classes = new InMemoryClasses();
        const courses = new InMemoryCourses();
        const charges = new InMemoryCharges();
        const { course, courseClass } = setupCourseStructure();
        classes.seed(courseClass);
        courses.seed(course);
        const request = EnrollmentRequest.create({
            id: 'req-3',
            schoolId: 'school-1',
            courseClassId: courseClass.id,
            requestedForUserId: 'user-1',
            enrollmentFeeCents: 18000,
            enrollmentFeeDueDate: new Date('2024-01-20'),
            firstMonthlyPaymentDate: new Date('2024-02-05')
        });
        requests.seed(request);

        const useCase = new ApproveEnrollmentRequest(requests, enrollments, classes, courses, charges);
        const approval = await useCase.exec({ requestId: request.id, approverUserId: 'user-1' });

        const savedCharges = charges.all();
        expect(approval.enrollmentFeeChargeId).toBe(savedCharges[0].id);
        expect(savedCharges).toHaveLength(1);
        expect(savedCharges[0].chargeType).toBe('ENROLLMENT');
        expect(savedCharges[0].amountCents).toBe(18000);
        expect(savedCharges[0].description).toBe('Enrollment fee');
        expect(savedCharges[0].dueDate.toISOString().slice(0, 10)).toBe('2024-01-20');
        expect(savedCharges[0].asaasPaymentId).toBeNull();
        expect(savedCharges[0].status).toBe('PENDING_SYNC');
    });

    it('applies discount to enrollment fee when request has discount', async () => {
        const enrollments = new InMemoryEnrollments();
        const requests = new InMemoryRequests();
        const classes = new InMemoryClasses();
        const courses = new InMemoryCourses();
        const charges = new InMemoryCharges();
        const { course, courseClass } = setupCourseStructure();
        classes.seed(courseClass);
        courses.seed(course);
        const request = EnrollmentRequest.create({
            id: 'req-discount-fee',
            schoolId: 'school-1',
            courseClassId: courseClass.id,
            requestedForUserId: 'user-1',
            enrollmentFeeCents: 20000,
            enrollmentFeeDueDate: new Date('2024-01-20'),
            discountCents: 5000,
            discountMonths: 3,
            firstMonthlyPaymentDate: new Date('2024-02-05')
        });
        requests.seed(request);

        const useCase = new ApproveEnrollmentRequest(requests, enrollments, classes, courses, charges);
        await useCase.exec({ requestId: request.id, approverUserId: 'user-1' });

        const savedCharges = charges.all();
        const enrollmentCharge = savedCharges.find((c) => c.chargeType === 'ENROLLMENT');
        expect(enrollmentCharge).toBeDefined();
        expect(enrollmentCharge!.amountCents).toBe(20000);
        expect(enrollmentCharge!.discountCents).toBe(5000);
        expect(enrollmentCharge!.discountReason).toBe('Desconto aplicado na matrícula');
    });

    it('caps enrollment fee discount at fee amount when discount exceeds fee', async () => {
        const enrollments = new InMemoryEnrollments();
        const requests = new InMemoryRequests();
        const classes = new InMemoryClasses();
        const courses = new InMemoryCourses();
        const charges = new InMemoryCharges();
        const { course, courseClass } = setupCourseStructure();
        classes.seed(courseClass);
        courses.seed(course);
        const request = EnrollmentRequest.create({
            id: 'req-cap-discount',
            schoolId: 'school-1',
            courseClassId: courseClass.id,
            requestedForUserId: 'user-1',
            enrollmentFeeCents: 10000,
            enrollmentFeeDueDate: new Date('2024-01-20'),
            discountCents: 15000,
            discountMonths: 2,
            firstMonthlyPaymentDate: new Date('2024-02-05')
        });
        requests.seed(request);

        const useCase = new ApproveEnrollmentRequest(requests, enrollments, classes, courses, charges);
        await useCase.exec({ requestId: request.id, approverUserId: 'user-1' });

        const savedCharges = charges.all();
        const enrollmentCharge = savedCharges.find((c) => c.chargeType === 'ENROLLMENT');
        expect(enrollmentCharge).toBeDefined();
        expect(enrollmentCharge!.amountCents).toBe(10000);
        expect(enrollmentCharge!.discountCents).toBe(10000);
    });

    it('uses first monthly payment date when fee due date is missing', async () => {
        const enrollments = new InMemoryEnrollments();
        const requests = new InMemoryRequests();
        const classes = new InMemoryClasses();
        const courses = new InMemoryCourses();
        const charges = new InMemoryCharges();
        const { course, courseClass } = setupCourseStructure();
        classes.seed(courseClass);
        courses.seed(course);
        const request = EnrollmentRequest.create({
            id: 'req-4',
            schoolId: 'school-1',
            courseClassId: courseClass.id,
            requestedForUserId: 'user-1',
            enrollmentFeeCents: 12000,
            firstMonthlyPaymentDate: new Date('2024-03-10')
        });
        requests.seed(request);

        const useCase = new ApproveEnrollmentRequest(requests, enrollments, classes, courses, charges);
        const approval = await useCase.exec({ requestId: request.id, approverUserId: 'user-1' });

        const savedCharges = charges.all();
        expect(approval.enrollmentFeeChargeId).toBe(savedCharges[0].id);
        expect(savedCharges).toHaveLength(1);
        expect(savedCharges[0].dueDate.toISOString().slice(0, 10)).toBe('2024-03-10');
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
            createdAt: new Date('2024-01-01T10:00:00Z'),
            firstMonthlyPaymentDate: new Date('2024-02-01')
        });
        const second = EnrollmentRequest.create({
            id: 'req-2',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'user-1',
            requestedForDependentId: 'dep-1',
            createdAt: new Date('2024-02-01T10:00:00Z'),
            firstMonthlyPaymentDate: new Date('2024-02-15')
        });
        (second as any)._status = 'APPROVED';
        const other = EnrollmentRequest.create({
            id: 'req-3',
            schoolId: 'school-2',
            courseClassId: 'class-2',
            requestedForUserId: 'user-2',
            createdAt: new Date('2024-03-01T10:00:00Z'),
            firstMonthlyPaymentDate: new Date('2024-03-10')
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
            requestedForUserId: 'user-1',
            firstMonthlyPaymentDate: new Date('2024-02-01')
        });
        const second = EnrollmentRequest.create({
            id: 'req-11',
            schoolId: 'school-1',
            courseClassId: 'class-2',
            requestedForUserId: 'user-2',
            firstMonthlyPaymentDate: new Date('2024-02-01')
        });
        const other = EnrollmentRequest.create({
            id: 'req-12',
            schoolId: 'school-2',
            courseClassId: 'class-3',
            requestedForUserId: 'user-3',
            firstMonthlyPaymentDate: new Date('2024-02-01')
        });
        requests.seed(first);
        requests.seed(second);
        requests.seed(other);

        const useCase = new ListEnrollmentRequests(requests);
        const result = await useCase.exec({ schoolId: 'school-1' });
        expect(result.map(({ id }) => id).sort()).toEqual(['req-10', 'req-11']);
    });

    it('filters by course id and student document', async () => {
        const requests = new InMemoryRequests();
        const first = EnrollmentRequest.create({
            id: 'req-20',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'user-1',
            firstMonthlyPaymentDate: new Date('2024-02-01')
        });
        const second = EnrollmentRequest.create({
            id: 'req-21',
            schoolId: 'school-1',
            courseClassId: 'class-2',
            requestedForUserId: 'user-2',
            firstMonthlyPaymentDate: new Date('2024-02-01')
        });
        const third = EnrollmentRequest.create({
            id: 'req-22',
            schoolId: 'school-1',
            courseClassId: 'class-3',
            requestedForUserId: 'user-3',
            firstMonthlyPaymentDate: new Date('2024-02-01')
        });

        requests.seed(first);
        requests.seed(second);
        requests.seed(third);

        requests.setCourseForClass('class-1', 'course-1');
        requests.setCourseForClass('class-2', 'course-2');
        requests.setCourseForClass('class-3', 'course-1');

        requests.setStudentDocument('req-20', '12345678901');
        requests.setStudentDocument('req-21', '99999999999');
        requests.setStudentDocument('req-22', '12345678901');

        const useCase = new ListEnrollmentRequests(requests);
        const byCourse = await useCase.exec({ schoolId: 'school-1', courseId: 'course-1' });
        expect(byCourse.map(({ id }) => id).sort()).toEqual(['req-20', 'req-22']);

        const byDocument = await useCase.exec({ schoolId: 'school-1', studentDocument: '123.456.789-01' });
        expect(byDocument.map(({ id }) => id).sort()).toEqual(['req-20', 'req-22']);
    });

    it('validates student document format', async () => {
        const requests = new InMemoryRequests();
        const useCase = new ListEnrollmentRequests(requests);
        await expect(useCase.exec({ schoolId: 'school-1', studentDocument: '123' }))
            .rejects.toThrow('Invalid student document');
    });
});

describe('GetEnrollmentRequest', () => {
    it('returns the request when it exists', async () => {
        const requests = new InMemoryRequests();
        const request = EnrollmentRequest.create({
            id: 'req-10',
            schoolId: 'school-1',
            courseClassId: 'class-1',
            requestedForUserId: 'user-1',
            firstMonthlyPaymentDate: new Date('2024-02-01')
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

describe('IssueEnrollmentFeeBoleto', () => {
    it('issues boleto for pending enrollment charge', async () => {
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const charges = new InMemoryCharges();
        const { school, course, courseClass } = setupCourseStructure();
        schools.seed(school);
        const user = makeUser('user-boleto');
        users.seed(user);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-1',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: courseClass.id,
            chargeType: 'ENROLLMENT',
            description: 'Taxa de matrícula',
            amountCents: 15000,
            dueDate: new Date('2024-04-10')
        });
        await charges.save(charge);

        const provider = new FakePaymentProvider({
            providerRef: 'asaas-pay-1',
            boletoUrl: 'https://asaas.test/boleto/1',
            digitableLine: '12345',
            barcode: '67890',
            dueDate: new Date('2024-04-10')
        });

        const issueBoleto = new IssueEnrollmentFeeBoleto(charges, users, schools, provider);
        const result = await issueBoleto.exec({
            chargeId: charge.id,
            requester: { id: user.id, persona: UserPersonaEnum.STUDENT }
        });

        expect(result.paymentProviderRef).toBe('asaas-pay-1');
        expect(result.boletoUrl).toBe('https://asaas.test/boleto/1');
        expect(result.digitableLine).toBe('12345');
        expect(result.status).toBe('OPEN');
        expect(provider.callCount).toBe(1);

        const stored = (await charges.findById(charge.id))!;
        expect(stored.asaasPaymentId).toBe('asaas-pay-1');
        expect(stored.status).toBe('OPEN');
    });

    it('reuses existing boleto data when already issued', async () => {
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const charges = new InMemoryCharges();
        const { school, course, courseClass } = setupCourseStructure();
        schools.seed(school);
        const user = makeUser('user-existing');
        users.seed(user);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-2',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: courseClass.id,
            chargeType: 'ENROLLMENT',
            amountCents: 12000,
            dueDate: new Date('2024-05-05')
        });
        charge.markAsSynced({
            paymentId: 'asaas-existing',
            invoiceUrl: 'https://asaas.test/boleto/2',
            payload: {
                digitableLine: '54321',
                barcode: '09876',
                dueDate: new Date('2024-05-05').toISOString()
            }
        });
        await charges.save(charge);

        const provider = new FakePaymentProvider({
            providerRef: 'asaas-new',
            dueDate: new Date('2024-05-05')
        });

        const issueBoleto = new IssueEnrollmentFeeBoleto(charges, users, schools, provider);
        const result = await issueBoleto.exec({
            chargeId: charge.id,
            requester: { id: user.id, persona: UserPersonaEnum.STUDENT }
        });

        expect(result.paymentProviderRef).toBe('asaas-existing');
        expect(result.digitableLine).toBe('54321');
        expect(provider.callCount).toBe(0);
    });

    it('validates requester permissions', async () => {
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const charges = new InMemoryCharges();
        const { school, course, courseClass } = setupCourseStructure();
        schools.seed(school);
        const owner = makeUser('owner-user');
        const other = makeUser('other-user');
        users.seed(owner);
        users.seed(other);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-3',
            schoolId: school.id,
            ownerUserId: owner.id,
            studentUserId: owner.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: courseClass.id,
            chargeType: 'ENROLLMENT',
            amountCents: 9000,
            dueDate: new Date('2024-06-01')
        });
        await charges.save(charge);

        const provider = new FakePaymentProvider({
            providerRef: 'asaas-pay-3',
            dueDate: new Date('2024-06-01')
        });
        const issueBoleto = new IssueEnrollmentFeeBoleto(charges, users, schools, provider);

        await expect(issueBoleto.exec({
            chargeId: charge.id,
            requester: { id: other.id, persona: UserPersonaEnum.STUDENT }
        })).rejects.toThrow('User not allowed to issue boleto for this charge');
    });

    it('rejects charges with ineligible status', async () => {
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const charges = new InMemoryCharges();
        const { school, course, courseClass } = setupCourseStructure();
        schools.seed(school);
        const user = makeUser('user-ineligible');
        users.seed(user);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-4',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: courseClass.id,
            chargeType: 'ENROLLMENT',
            amountCents: 13500,
            dueDate: new Date('2024-07-01')
        });
        (charge as any)._status = 'CANCELLED';
        await charges.save(charge);

        const provider = new FakePaymentProvider({
            providerRef: 'asaas-pay-4',
            dueDate: new Date('2024-07-01')
        });
        const issueBoleto = new IssueEnrollmentFeeBoleto(charges, users, schools, provider);

        await expect(issueBoleto.exec({
            chargeId: charge.id,
            requester: { id: user.id, persona: UserPersonaEnum.STUDENT }
        })).rejects.toThrow('Charge is not eligible for boleto issuance');
    });
});
