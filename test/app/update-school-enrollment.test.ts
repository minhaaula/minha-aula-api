import { describe, expect, it } from 'vitest';
import { UpdateSchoolEnrollment } from '../../src/app/use-cases/schools/update-school-enrollment';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';
import { Enrollment } from '../../src/domain/entities/enrollment';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../src/ports/repositories/enrollment.repo';

class InMemoryCourseRepo implements CourseRepository {
    constructor(private readonly course: Course) {}
    async findById(id: string) {
        return id === this.course.id ? this.course : null;
    }
    async findBySchoolAndName() {
        return null;
    }
    async findBySchoolId() {
        return [this.course];
    }
    async save() {}
    async findAllWithFilters() {
        return [];
    }
}

class InMemoryClassRepo implements CourseClassRepository {
    constructor(private readonly cls: CourseClass) {}
    async findById(id: string) {
        return id === this.cls.id ? this.cls : null;
    }
    async findByCourseId() {
        return [this.cls];
    }
    async save() {}
}

class InMemoryEnrollmentRepo implements EnrollmentRepository {
    public saved: Enrollment | null = null;
    constructor(private enrollment: Enrollment) {}
    async findById(id: string) {
        return id === this.enrollment.id ? this.enrollment : null;
    }
    async findByClassAndUser() {
        return null;
    }
    async findByClassAndDependent() {
        return null;
    }
    async findActiveByClassIds() {
        return [];
    }
    async findActiveByDependentId() {
        return [];
    }
    async save(enrollment: Enrollment) {
        this.saved = enrollment;
    }
}

function makeCourse(monthly = 20000) {
    return Course.create({
        id: 'course-1',
        schoolId: 'school-1',
        name: 'Dança',
        description: null,
        monthlyPriceCents: monthly,
        isActive: true
    });
}

function makeClass() {
    return CourseClass.create({
        id: 'class-1',
        courseId: 'course-1',
        label: 'Turma A',
        schedule: [{ day: 'MONDAY', start: '09:00', end: '10:00' }],
        monthlyPriceCents: null
    });
}

function makeEnrollment() {
    return Enrollment.createForUser({
        id: 'enr-1',
        courseClassId: 'class-1',
        ownerUserId: 'user-1',
        studentUserId: 'user-1',
        fullAmountCents: 20000,
        paymentDueDay: 10,
        discountCents: 5000,
        discountMonths: 3
    });
}

describe('UpdateSchoolEnrollment', () => {
    it('updates payment due day and discount', async () => {
        const enrollment = makeEnrollment();
        const useCase = new UpdateSchoolEnrollment(
            new InMemoryCourseRepo(makeCourse()),
            new InMemoryClassRepo(makeClass()),
            new InMemoryEnrollmentRepo(enrollment)
        );

        const result = await useCase.exec({
            schoolId: 'school-1',
            courseId: 'course-1',
            classId: 'class-1',
            enrollmentId: 'enr-1',
            paymentDueDay: 15,
            discountCents: 3000,
            discountMonths: 2
        });

        expect(result.paymentDueDay).toBe(15);
        expect(result.discountCents).toBe(3000);
        expect(result.discountMonths).toBe(2);
    });

    it('clears discount', async () => {
        const enrollment = makeEnrollment();
        const repo = new InMemoryEnrollmentRepo(enrollment);
        const useCase = new UpdateSchoolEnrollment(
            new InMemoryCourseRepo(makeCourse()),
            new InMemoryClassRepo(makeClass()),
            repo
        );

        await useCase.exec({
            schoolId: 'school-1',
            courseId: 'course-1',
            classId: 'class-1',
            enrollmentId: 'enr-1',
            clearDiscount: true
        });

        expect(repo.saved!.discountCents).toBeNull();
        expect(repo.saved!.discountMonths).toBeNull();
    });

    it('applies and removes tuition exemption', async () => {
        const enrollment = makeEnrollment();
        const repo = new InMemoryEnrollmentRepo(enrollment);
        const useCase = new UpdateSchoolEnrollment(
            new InMemoryCourseRepo(makeCourse()),
            new InMemoryClassRepo(makeClass()),
            repo
        );

        const exempt = await useCase.exec({
            schoolId: 'school-1',
            courseId: 'course-1',
            classId: 'class-1',
            enrollmentId: 'enr-1',
            tuitionExempt: true,
            tuitionExemptionType: 'SCHOLARSHIP'
        });

        expect(exempt.tuitionExempt).toBe(true);
        expect(exempt.tuitionExemptionType).toBe('SCHOLARSHIP');
        expect(exempt.fullAmountCents).toBeNull();
        expect(exempt.discountCents).toBeNull();

        const restored = await useCase.exec({
            schoolId: 'school-1',
            courseId: 'course-1',
            classId: 'class-1',
            enrollmentId: 'enr-1',
            tuitionExempt: false
        });

        expect(restored.tuitionExempt).toBe(false);
        expect(restored.fullAmountCents).toBe(20000);
    });
});

describe('updateSchoolEnrollmentSchema', () => {
    it('permite isenção sem firstMonthlyPaymentDate', async () => {
        const { updateSchoolEnrollmentSchema } = await import(
            '../../src/infra/http/validators/update-school-enrollment-schemas'
        );
        const parsed = updateSchoolEnrollmentSchema.parse({
            tuitionExempt: true,
            tuitionExemptionType: 'SCHOLARSHIP'
        });
        expect(parsed.tuitionExempt).toBe(true);
        expect(parsed.firstMonthlyPaymentDate).toBeUndefined();
    });

    it('trata firstMonthlyPaymentDate vazio como ausente', async () => {
        const { updateSchoolEnrollmentSchema } = await import(
            '../../src/infra/http/validators/update-school-enrollment-schemas'
        );
        const parsed = updateSchoolEnrollmentSchema.parse({
            tuitionExempt: true,
            tuitionExemptionType: 'NONPROFIT',
            firstMonthlyPaymentDate: ''
        });
        expect(parsed.firstMonthlyPaymentDate).toBeUndefined();
    });
});
