import { describe, expect, it } from 'vitest';
import { GetMyEnrollmentByCourse } from '../../src/app/use-cases/students/get-my-enrollment-by-course';
import type {
    EnrollmentRepository,
    MyEnrollmentDetailByCourseRow
} from '../../src/ports/repositories/enrollment.repo';
import { AppError, ErrorCode } from '../../src/shared/errors';

class InMemoryEnrollments implements Pick<EnrollmentRepository, 'findMyEnrollmentDetailsByCourseId'> {
    constructor(private readonly rows: MyEnrollmentDetailByCourseRow[]) {}

    async findMyEnrollmentDetailsByCourseId(
        ownerUserId: string,
        courseId: string
    ): Promise<MyEnrollmentDetailByCourseRow[]> {
        return this.rows.filter((row) => row.ownerUserId === ownerUserId && row.courseId === courseId);
    }
}

const baseRow: MyEnrollmentDetailByCourseRow = {
    enrollmentId: 'enr-1',
    enrolledAt: new Date('2025-01-15T12:00:00.000Z'),
    status: 'ACTIVE',
    studentType: 'DEPENDENT',
    studentName: 'Filho',
    studentCpf: null,
    courseId: 'course-1',
    courseName: 'Inglês',
    classId: 'class-1',
    className: 'Turma A',
    schedule: [{ day: 'SEG', start: '19:00', end: '20:00' }],
    schoolId: 'school-1',
    schoolName: 'Escola Teste',
    schoolCnpj: null,
    ownerUserId: 'owner-1',
    ownerFullName: 'Titular Silva',
    ownerCpf: '12345678909',
    ownerEmail: 'titular@example.com',
    ownerPhone: '11999999999',
    tuitionExemptionType: null,
    fullAmountCents: 50000,
    paymentDueDay: 10,
    discountCents: 5000,
    discountMonths: 3,
    courseMonthlyPriceCents: 50000,
    classMonthlyPriceCents: null
};

describe('GetMyEnrollmentByCourse', () => {
    it('retorna matrícula com escola, turma, responsável e desconto até o mês', async () => {
        const useCase = new GetMyEnrollmentByCourse(new InMemoryEnrollments([baseRow]));
        const result = await useCase.exec({ ownerUserId: 'owner-1', courseId: 'course-1' });

        expect(result.enrollments).toHaveLength(1);
        expect(result.enrollments[0]).toMatchObject({
            enrollmentId: 'enr-1',
            enrollmentActive: true,
            studentType: 'DEPENDENT',
            course: { id: 'course-1', name: 'Inglês' },
            class: { id: 'class-1', name: 'Turma A' },
            school: { cnpj: null, cpf: '12345678909' },
            responsible: { fullName: 'Titular Silva', cpf: '12345678909' },
            monthlyTuitionAmount: 500,
            discountAmount: 50,
            discountMonths: 3,
            discountValidUntilMonth: 'Mar',
            tuitionExempt: false,
            paymentDueDay: 10
        });
    });

    it('retorna 404 quando não há matrícula no curso', async () => {
        const useCase = new GetMyEnrollmentByCourse(new InMemoryEnrollments([]));
        await expect(
            useCase.exec({ ownerUserId: 'owner-1', courseId: 'course-1' })
        ).rejects.toMatchObject({ code: ErrorCode.ENROLLMENT_NOT_FOUND });
    });
});
