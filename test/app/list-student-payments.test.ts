import { describe, expect, it } from 'vitest';
import { ListStudentPayments } from '../../src/app/use-cases/list-student-payments';
import { SchoolFinancialChargeRepository, StudentPaymentInfo } from '../../src/ports/repositories/school-financial-charge.repo';
import { SchoolFinancialChargeStatus } from '../../src/domain/entities/school-financial-charge';

function makePayment(
    chargeId: string,
    courseName: string,
    studentName: string,
    amountCents: number,
    dueDate: Date,
    status: SchoolFinancialChargeStatus,
    overrides?: Partial<StudentPaymentInfo>
): StudentPaymentInfo {
    const netAmountCents = (overrides?.discountCents ?? 0) > 0
        ? (overrides?.netAmountCents ?? amountCents - (overrides?.discountCents ?? 0))
        : (overrides?.netAmountCents ?? amountCents);
    return {
        chargeId,
        courseName,
        studentName,
        rawDescription: overrides?.rawDescription ?? null,
        amountCents,
        discountCents: overrides?.discountCents ?? null,
        netAmountCents: overrides?.netAmountCents ?? netAmountCents,
        dueDate,
        status,
        chargeType: overrides?.chargeType ?? 'TUITION',
        schoolId: overrides?.schoolId ?? 'school-1',
        paidAt: overrides?.paidAt ?? (status === 'PAID' ? dueDate : null),
        paidObservation: overrides?.paidObservation ?? null,
        ...overrides
    };
}

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

describe('ListStudentPayments use case', () => {
    it('returns all payments for a user', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';
        const futureDue = new Date();
        futureDue.setFullYear(futureDue.getFullYear() + 2);

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês Básico', 'João Silva', 50000, futureDue, 'OPEN'),
            makePayment('charge-2', 'Matemática', 'João Silva', 60000, new Date('2024-02-15'), 'PAID')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId });

        expect(result.payments).toHaveLength(2);
        expect(result.payments[0].courseName).toBe('Inglês Básico');
        expect(result.payments[0].description).toMatch(/^Mensalidade de .+ de \d{4}$/);
        expect(result.payments[0].studentName).toBe('João Silva');
        expect(result.payments[0].amountCents).toBe(50000);
        expect(result.payments[0].netAmountCents).toBe(50000);
        expect(result.payments[0].discountCents).toBeNull();
        expect(result.payments[0].status).toBe('pendente');
        expect(result.payments[0].type).toBe('Mensalidade');
        expect(result.payments[0].paidAt).toBeNull();
        expect(result.payments[0].schoolLogo).toBeNull();
        expect(result.payments[0].paidObservation).toBeNull();

        expect(result.payments[1].courseName).toBe('Matemática');
        expect(result.payments[1].netAmountCents).toBe(60000);
        expect(result.payments[1].status).toBe('pago');
        expect(result.payments[1].type).toBe('Mensalidade');
        expect(result.payments[1].paidAt).toEqual(new Date('2024-02-15'));
    });

    it('filters payments by status pendente', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';
        const futureDue = new Date();
        futureDue.setFullYear(futureDue.getFullYear() + 2);

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês Básico', 'João Silva', 50000, futureDue, 'OPEN'),
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
        const futureDue = new Date();
        futureDue.setFullYear(futureDue.getFullYear() + 2);

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Curso 1', 'Aluno', 10000, futureDue, 'PENDING_SYNC'),
            makePayment('charge-2', 'Curso 2', 'Aluno', 20000, futureDue, 'OPEN'),
            makePayment('charge-3', 'Curso 3', 'Aluno', 30000, new Date('2020-01-01'), 'OVERDUE'),
            makePayment('charge-4', 'Curso 4', 'Aluno', 40000, new Date('2024-02-01'), 'PAID'),
            makePayment('charge-5', 'Curso 5', 'Aluno', 50000, futureDue, 'CANCELLED'),
            makePayment('charge-6', 'Curso 6', 'Aluno', 60000, futureDue, 'FAILED')
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

    it('returns tuition description as "Mensalidade de {mês} de {ano}" from due date', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';
        const feb2026 = new Date(Date.UTC(2026, 1, 5));

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Curso X', 'João', 50000, feb2026, 'OPEN')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId });

        expect(result.payments[0].description).toBe('Mensalidade de Fevereiro de 2026');
    });

    it('returns type matricula, discount, netAmountCents and paidObservation', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês', 'João Silva', 30000, new Date('2024-01-10'), 'PAID', {
                chargeType: 'ENROLLMENT',
                rawDescription: 'Matrícula curso Inglês',
                discountCents: 5000,
                netAmountCents: 25000,
                paidAt: new Date('2024-01-09'),
                paidObservation: 'Pago em dinheiro na secretaria'
            })
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId });

        expect(result.payments).toHaveLength(1);
        expect(result.payments[0].type).toBe('Matrícula');
        expect(result.payments[0].description).toBe('Matrícula curso Inglês');
        expect(result.payments[0].amountCents).toBe(30000);
        expect(result.payments[0].discountCents).toBe(5000);
        expect(result.payments[0].netAmountCents).toBe(25000);
        expect(result.payments[0].paidAt).toEqual(new Date('2024-01-09'));
        expect(result.payments[0].paidObservation).toBe('Pago em dinheiro na secretaria');
    });

    it('displays atrasado when charge is OPEN and due date has passed', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';
        const pastDue = new Date();
        pastDue.setDate(pastDue.getDate() - 5);

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês', 'João', 50000, pastDue, 'OPEN')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId });

        expect(result.payments).toHaveLength(1);
        expect(result.payments[0].status).toBe('atrasado');
    });

    it('displays pendente when charge is OPEN and due date is today or in the future', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';
        const futureDue = new Date();
        futureDue.setDate(futureDue.getDate() + 3);

        repo.seedPayments(userId, [
            makePayment('charge-1', 'Inglês', 'João', 50000, futureDue, 'OPEN')
        ]);

        const useCase = new ListStudentPayments(repo);
        const result = await useCase.exec({ userId });

        expect(result.payments).toHaveLength(1);
        expect(result.payments[0].status).toBe('pendente');
    });
});

