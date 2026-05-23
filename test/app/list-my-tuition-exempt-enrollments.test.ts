import { describe, expect, it } from 'vitest';
import { ListMyTuitionExemptEnrollments } from '../../src/app/use-cases/students/list-my-tuition-exempt-enrollments';
import type {
    EnrollmentRepository,
    MyTuitionExemptEnrollmentData
} from '../../src/ports/repositories/enrollment.repo';

class InMemoryEnrollmentRepository implements Pick<EnrollmentRepository, 'findMyTuitionExemptEnrollments'> {
    private readonly exemptByOwner = new Map<string, MyTuitionExemptEnrollmentData[]>();

    async findMyTuitionExemptEnrollments(userId: string): Promise<MyTuitionExemptEnrollmentData[]> {
        return (this.exemptByOwner.get(userId) ?? []).map((row) => ({ ...row }));
    }

    seed(ownerUserId: string, rows: MyTuitionExemptEnrollmentData[]) {
        this.exemptByOwner.set(ownerUserId, rows.map((row) => ({ ...row })));
    }
}

describe('ListMyTuitionExemptEnrollments', () => {
    it('retorna matrículas isentas com curso, turma, valor e mês corrente', async () => {
        const enrollments = new InMemoryEnrollmentRepository();
        enrollments.seed('owner-1', [
            {
                enrollmentId: 'enr-1',
                studentName: 'Maria Silva',
                courseId: 'course-1',
                courseName: 'Inglês',
                classId: 'class-1',
                className: 'Turma A',
                tuitionExemptionType: 'SCHOLARSHIP',
                monthlyTuitionAmountCents: 45000
            }
        ]);

        const useCase = new ListMyTuitionExemptEnrollments(enrollments);
        const result = await useCase.exec({ userId: 'owner-1' });

        expect(result.currentMonth.year).toBeGreaterThan(2020);
        expect(result.currentMonth.month).toBeGreaterThanOrEqual(1);
        expect(result.currentMonth.label).toMatch(/de \d{4}$/);
        expect(result.enrollments).toHaveLength(1);
        expect(result.enrollments[0]).toMatchObject({
            enrollmentId: 'enr-1',
            studentName: 'Maria Silva',
            course: { id: 'course-1', name: 'Inglês' },
            class: { id: 'class-1', name: 'Turma A' },
            tuitionExempt: true,
            tuitionExemptionType: 'SCHOLARSHIP',
            monthlyTuitionAmountCents: 45000,
            monthlyTuitionAmount: 450
        });
    });

    it('retorna lista vazia quando não há matrículas isentas', async () => {
        const useCase = new ListMyTuitionExemptEnrollments(new InMemoryEnrollmentRepository());
        const result = await useCase.exec({ userId: 'owner-2' });
        expect(result.enrollments).toEqual([]);
    });
});
