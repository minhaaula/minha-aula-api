import { describe, expect, it } from 'vitest';
import { CreateCourseClass } from '../../src/app/use-cases/courses/create-course-class';
import { UpdateCourseClass } from '../../src/app/use-cases/courses/update-course-class';
import { UpdateSchoolEnrollment } from '../../src/app/use-cases/schools/update-school-enrollment';
import { School } from '../../src/domain/entities/school';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';
import { Enrollment } from '../../src/domain/entities/enrollment';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import type { SchoolRepository } from '../../src/ports/repositories/school.repo';
import type { CourseRepository } from '../../src/ports/repositories/course.repo';
import type { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import type { EnrollmentRepository } from '../../src/ports/repositories/enrollment.repo';
import { AppError, ErrorCode } from '../../src/shared/errors';
import { EnrollStudent } from '../../src/app/use-cases/enrollments/enroll-student';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import {
    assertNonprofitSchoolAllowsClassMonthlyPrice,
    resolveEffectiveClassMonthlyPriceCents,
    resolveNonprofitTuitionExemptionType
} from '../../src/shared/nonprofit-school';

const address = PostalAddress.create({
    street: 'Rua A',
    number: '1',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000000'
});

function makeNonprofitSchool(id = 'school-npo') {
    return School.create({
        id,
        name: 'Associação Teste',
        email: 'npo@test.com',
        phone: '11999999999',
        cnpj: '11222333000181',
        addresses: [address],
        ownerName: 'Owner',
        ownerCpf: '12345678909',
        ownerEmail: 'owner@test.com',
        ownerWhatsapp: '11988887777',
        isNonprofitAssociation: true
    });
}

class InMemorySchoolRepo implements Pick<SchoolRepository, 'findById'> {
    constructor(private readonly school: School) {}
    async findById(id: string) {
        return id === this.school.id ? this.school : null;
    }
}

class InMemoryCourseRepo implements Pick<CourseRepository, 'findById'> {
    constructor(private readonly course: Course) {}
    async findById(id: string) {
        return id === this.course.id ? this.course : null;
    }
}

class InMemoryClassRepo implements Pick<CourseClassRepository, 'findById' | 'findByCourseAndLabel' | 'save'> {
    constructor(private readonly cls: CourseClass) {}
    async findById(id: string) {
        return id === this.cls.id ? this.cls : null;
    }
    async findByCourseAndLabel() {
        return null;
    }
    async save() {}
}

class InMemoryEnrollmentRepo implements Pick<EnrollmentRepository, 'findById' | 'save'> {
    constructor(private readonly enrollment: Enrollment) {}
    async findById(id: string) {
        return id === this.enrollment.id ? this.enrollment : null;
    }
    async save() {}
}

describe('nonprofit-school rules', () => {
    it('resolveEffectiveClassMonthlyPriceCents usa turma quando informada', () => {
        expect(resolveEffectiveClassMonthlyPriceCents(0, 5000)).toBe(0);
        expect(resolveEffectiveClassMonthlyPriceCents(null, 5000)).toBe(5000);
    });

    it('resolveNonprofitTuitionExemptionType força NONPROFIT na associação', () => {
        expect(resolveNonprofitTuitionExemptionType(false, null)).toBeNull();
        expect(resolveNonprofitTuitionExemptionType(false, 'SCHOLARSHIP')).toBe('SCHOLARSHIP');
        expect(resolveNonprofitTuitionExemptionType(true, null)).toBe('NONPROFIT');
        expect(resolveNonprofitTuitionExemptionType(true, 'SCHOLARSHIP')).toBe('NONPROFIT');
    });

    it('rejeita mensalidade efetiva acima de zero para associação sem fins lucrativos', () => {
        expect(() =>
            assertNonprofitSchoolAllowsClassMonthlyPrice(true, 100, null)
        ).toThrow(AppError);
        expect(() =>
            assertNonprofitSchoolAllowsClassMonthlyPrice(true, null, 100)
        ).toThrow(
            expect.objectContaining({ code: ErrorCode.NONPROFIT_CLASS_PRICE_NOT_ALLOWED })
        );
        expect(() => assertNonprofitSchoolAllowsClassMonthlyPrice(true, 0, 5000)).not.toThrow();
        expect(() => assertNonprofitSchoolAllowsClassMonthlyPrice(true, null, null)).not.toThrow();
    });

    it('CreateCourseClass bloqueia turma com valor em escola sem fins lucrativos', async () => {
        const school = makeNonprofitSchool();
        const course = Course.create({
            id: 'course-1',
            schoolId: school.id,
            name: 'Curso',
            description: null,
            monthlyPriceCents: null,
            isActive: true
        });

        const useCase = new CreateCourseClass(
            new InMemoryCourseRepo(course) as CourseRepository,
            {
                findByCourseAndLabel: async () => null,
                save: async () => {}
            } as CourseClassRepository,
            new InMemorySchoolRepo(school) as SchoolRepository
        );

        await expect(
            useCase.exec({
                schoolId: school.id,
                courseId: course.id,
                label: 'Turma A',
                classes: [{ day: 'Segunda', start: '08:00', end: '09:00' }],
                monthlyPriceCents: 1000
            })
        ).rejects.toMatchObject({ code: ErrorCode.NONPROFIT_CLASS_PRICE_NOT_ALLOWED });

        const created = await useCase.exec({
            schoolId: school.id,
            courseId: course.id,
            label: 'Turma B',
            classes: [{ day: 'Segunda', start: '08:00', end: '09:00' }],
            monthlyPriceCents: 0
        });
        expect(created.monthlyPriceCents).toBe(0);
    });

    it('UpdateSchoolEnrollment bloqueia edição em escola sem fins lucrativos', async () => {
        const school = makeNonprofitSchool();
        const course = Course.create({
            id: 'course-1',
            schoolId: school.id,
            name: 'Curso',
            description: null,
            monthlyPriceCents: 20000,
            isActive: true
        });
        const courseClass = CourseClass.create({
            id: 'class-1',
            courseId: course.id,
            label: 'Turma A',
            schedule: [{ day: 'MONDAY', start: '09:00', end: '10:00' }],
            monthlyPriceCents: null
        });
        const enrollment = Enrollment.createForUser({
            id: 'enr-1',
            courseClassId: courseClass.id,
            ownerUserId: 'user-1',
            studentUserId: 'user-1',
            tuitionExemptionType: 'NONPROFIT',
            fullAmountCents: null
        });

        const useCase = new UpdateSchoolEnrollment(
            new InMemoryCourseRepo(course) as CourseRepository,
            new InMemoryClassRepo(courseClass) as CourseClassRepository,
            new InMemoryEnrollmentRepo(enrollment) as EnrollmentRepository,
            new InMemorySchoolRepo(school) as SchoolRepository
        );

        await expect(
            useCase.exec({
                schoolId: school.id,
                courseId: course.id,
                classId: courseClass.id,
                enrollmentId: enrollment.id,
                paymentDueDay: 5
            })
        ).rejects.toMatchObject({ code: ErrorCode.NONPROFIT_ENROLLMENT_EDIT_FORBIDDEN });
    });

    it('EnrollStudent matricula sempre isenta (NONPROFIT) em escola sem fins lucrativos', async () => {
        const school = makeNonprofitSchool();
        const course = Course.create({
            id: 'course-1',
            schoolId: school.id,
            name: 'Curso',
            description: null,
            monthlyPriceCents: 50_000,
            isActive: true
        });
        const courseClass = CourseClass.create({
            id: 'class-1',
            courseId: course.id,
            label: 'Turma A',
            schedule: [{ day: 'MONDAY', start: '09:00', end: '10:00' }],
            monthlyPriceCents: null
        });
        const owner = User.create({
            id: 'user-1',
            fullName: 'Titular',
            email: Email.create('t@test.com'),
            phone: '11999999999',
            cpf: '12345678901',
            birthDate: new Date('1990-01-01'),
            address,
            persona: 'STUDENT' as never,
            createdAt: new Date()
        });

        const courses = {
            findById: async (id: string) => (id === course.id ? course : null)
        };
        const classes = {
            findById: async (id: string) => (id === courseClass.id ? courseClass : null)
        };
        const users = { findById: async () => owner };
        const dependents = { findById: async () => null };
        const enrollments = {
            findByClassAndUser: async () => null,
            findByClassAndDependent: async () => null,
            save: async () => {}
        };

        const useCase = new EnrollStudent(
            courses as never,
            classes as never,
            users as never,
            dependents as never,
            enrollments as never,
            new InMemorySchoolRepo(school) as never
        );

        const result = await useCase.exec({
            schoolId: school.id,
            courseId: course.id,
            classId: courseClass.id,
            studentUserId: owner.id,
            discount: 50,
            discountMonths: 3
        });

        expect(result.tuitionExempt).toBe(true);
        expect(result.tuitionExemptionType).toBe('NONPROFIT');
    });

    it('UpdateCourseClass bloqueia definir mensalidade em escola sem fins lucrativos', async () => {
        const school = makeNonprofitSchool();
        const course = Course.create({
            id: 'course-1',
            schoolId: school.id,
            name: 'Curso',
            description: null,
            monthlyPriceCents: null,
            isActive: true
        });
        const courseClass = CourseClass.create({
            id: 'class-1',
            courseId: course.id,
            label: 'Turma A',
            schedule: [{ day: 'MONDAY', start: '09:00', end: '10:00' }],
            monthlyPriceCents: 0
        });

        const useCase = new UpdateCourseClass(
            new InMemoryCourseRepo(course) as CourseRepository,
            new InMemoryClassRepo(courseClass) as CourseClassRepository,
            new InMemorySchoolRepo(school) as SchoolRepository
        );

        await expect(
            useCase.exec({
                schoolId: school.id,
                courseId: course.id,
                classId: courseClass.id,
                monthlyPriceCents: 500
            })
        ).rejects.toMatchObject({ code: ErrorCode.NONPROFIT_CLASS_PRICE_NOT_ALLOWED });
    });
});
