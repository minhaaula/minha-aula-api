import { describe, expect, it } from 'vitest';
import { ListStudentPayments } from '../../src/app/use-cases/list-student-payments';
import { SchoolFinancialChargeRepository, StudentPaymentInfo } from '../../src/ports/repositories/school-financial-charge.repo';
import { SchoolFinancialChargeStatus } from '../../src/domain/entities/school-financial-charge';

class InMemoryFinancialChargeRepository implements SchoolFinancialChargeRepository {
    private readonly items = new Map<string, StudentPaymentInfo[]>();

    async findById(): Promise<any> {
        return null;
    }

    async save(): Promise<void> {
        // No-op
    }

    async findByOwnerUserId(ownerUserId: string, filters?: {
        status?: SchoolFinancialChargeStatus;
        isPaid?: boolean;
    }): Promise<StudentPaymentInfo[]> {
        const allPayments = this.items.get(ownerUserId) || [];
        
        return allPayments.filter(payment => {
            if (filters?.status && payment.status !== filters.status) {
                return false;
            }

            if (filters?.isPaid !== undefined) {
                if (filters.isPaid && payment.status !== 'PAID') {
                    return false;
                }
                if (!filters.isPaid && payment.status === 'PAID') {
                    return false;
                }
            }

            return true;
        });
    }

    seedPayments(ownerUserId: string, payments: StudentPaymentInfo[]) {
        this.items.set(ownerUserId, payments);
    }
}

function makePayment(
    chargeId: string,
    courseName: string,
    studentName: string,
    amountCents: number,
    dueDate: Date,
    status: SchoolFinancialChargeStatus
): StudentPaymentInfo {
    return {
        chargeId,
        courseName,
        studentName,
        amountCents,
        dueDate,
        status
    };
}

describe('ListStudentPayments use case', () => {
    it('returns all payments for a user', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês Básico', 'João Silva', 50000, new Date('2024-02-01'), 'OPEN'),
            makePayment('charge-2', 'Matemática', 'João Silva', 60000, new Date('2024-02-15'), 'PAID')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId });

        expect(result.payments).toHaveLength(2);
        expect(result.payments[0].courseName).toBe('Inglês Básico');
        expect(result.payments[0].studentName).toBe('João Silva');
        expect(result.payments[0].amountCents).toBe(50000);
        expect(result.payments[0].status).toBe('pendente');
    });

    it('filters payments by status pendente', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês Básico', 'João Silva', 50000, new Date('2024-02-01'), 'OPEN'),
            makePayment('charge-2', 'Matemática', 'João Silva', 60000, new Date('2024-02-15'), 'PAID'),
            makePayment('charge-3', 'História', 'João Silva', 45000, new Date('2024-03-01'), 'OVERDUE')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId, status: 'pendente' });

        expect(result.payments).toHaveLength(1);
        expect(result.payments[0].status).toBe('pendente');
        expect(result.payments[0].courseName).toBe('Inglês Básico');
    });

    it('filters payments by status atrasado', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês Básico', 'João Silva', 50000, new Date('2024-02-01'), 'OPEN'),
            makePayment('charge-2', 'Matemática', 'João Silva', 60000, new Date('2024-02-15'), 'OVERDUE')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId, status: 'atrasado' });

        expect(result.payments).toHaveLength(1);
        expect(result.payments[0].status).toBe('atrasado');
        expect(result.payments[0].courseName).toBe('Matemática');
    });

    it('filters payments by status pago', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês Básico', 'João Silva', 50000, new Date('2024-02-01'), 'OPEN'),
            makePayment('charge-2', 'Matemática', 'João Silva', 60000, new Date('2024-02-15'), 'PAID')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId, status: 'pago' });

        expect(result.payments).toHaveLength(1);
        expect(result.payments[0].status).toBe('pago');
        expect(result.payments[0].courseName).toBe('Matemática');
    });

    it('filters payments by isPaid true (only paid)', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês Básico', 'João Silva', 50000, new Date('2024-02-01'), 'OPEN'),
            makePayment('charge-2', 'Matemática', 'João Silva', 60000, new Date('2024-02-15'), 'PAID'),
            makePayment('charge-3', 'História', 'João Silva', 45000, new Date('2024-03-01'), 'OVERDUE')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId, isPaid: true });

        expect(result.payments).toHaveLength(1);
        expect(result.payments[0].status).toBe('pago');
        expect(result.payments[0].courseName).toBe('Matemática');
    });

    it('filters payments by isPaid false (only open)', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês Básico', 'João Silva', 50000, new Date('2024-02-01'), 'OPEN'),
            makePayment('charge-2', 'Matemática', 'João Silva', 60000, new Date('2024-02-15'), 'PAID'),
            makePayment('charge-3', 'História', 'João Silva', 45000, new Date('2024-03-01'), 'OVERDUE')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId, isPaid: false });

        expect(result.payments).toHaveLength(2);
        expect(result.payments.every(p => p.status !== 'pago')).toBe(true);
    });

    it('maps status correctly', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Curso 1', 'Aluno', 10000, new Date('2024-02-01'), 'PENDING_SYNC'),
            makePayment('charge-2', 'Curso 2', 'Aluno', 20000, new Date('2024-02-01'), 'OPEN'),
            makePayment('charge-3', 'Curso 3', 'Aluno', 30000, new Date('2024-02-01'), 'OVERDUE'),
            makePayment('charge-4', 'Curso 4', 'Aluno', 40000, new Date('2024-02-01'), 'PAID'),
            makePayment('charge-5', 'Curso 5', 'Aluno', 50000, new Date('2024-02-01'), 'CANCELLED'),
            makePayment('charge-6', 'Curso 6', 'Aluno', 60000, new Date('2024-02-01'), 'FAILED')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId });

        expect(result.payments).toHaveLength(6);
        expect(result.payments[0].status).toBe('pendente');
        expect(result.payments[1].status).toBe('pendente');
        expect(result.payments[2].status).toBe('atrasado');
        expect(result.payments[3].status).toBe('pago');
        expect(result.payments[4].status).toBe('cancelado');
        expect(result.payments[5].status).toBe('falhou');
    });

    it('returns empty list when user has no payments', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId });

        expect(result.payments).toHaveLength(0);
    });

    it('returns empty list when userId is empty', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId: '' });

        expect(result.payments).toHaveLength(0);
    });

    it('returns empty list when repository does not support findByOwnerUserId', async () => {
        const repo = {
            findById: async () => null,
            save: async () => {}
        } as SchoolFinancialChargeRepository;

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId: 'user-1' });

        expect(result.payments).toHaveLength(0);
    });

    it('handles payments for dependents', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês Básico', 'João Silva', 50000, new Date('2024-02-01'), 'OPEN'),
            makePayment('charge-2', 'Matemática', 'Maria Silva (Dependente)', 60000, new Date('2024-02-15'), 'PAID')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId });

        expect(result.payments).toHaveLength(2);
        expect(result.payments[0].studentName).toBe('João Silva');
        expect(result.payments[1].studentName).toBe('Maria Silva (Dependente)');
    });
});

