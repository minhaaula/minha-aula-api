import { describe, expect, it } from 'vitest';
import { ListStudentPaidTotalsByYear } from '../../src/app/use-cases/students/list-student-paid-totals-by-year';
import {
    SchoolFinancialChargeRepository,
    StudentPaidTotalByYear
} from '../../src/ports/repositories/school-financial-charge.repo';

class InMemoryFinancialChargeRepository implements SchoolFinancialChargeRepository {
    private totals = new Map<string, StudentPaidTotalByYear[]>();

    async findById(): Promise<null> {
        return null;
    }

    async findByAsaasPaymentId(): Promise<null> {
        return null;
    }

    async save(): Promise<void> {
        // No-op
    }

    async getPaidTotalsByYearForOwnerUserId(ownerUserId: string): Promise<StudentPaidTotalByYear[]> {
        return this.totals.get(ownerUserId) ?? [];
    }

    seedTotals(ownerUserId: string, totals: StudentPaidTotalByYear[]) {
        this.totals.set(ownerUserId, totals);
    }
}

class RepositoryWithoutTotals implements SchoolFinancialChargeRepository {
    async findById(): Promise<null> {
        return null;
    }

    async findByAsaasPaymentId(): Promise<null> {
        return null;
    }

    async save(): Promise<void> {
        // No-op
    }
}

describe('ListStudentPaidTotalsByYear use case', () => {
    it('returns totals grouped by year ordered desc', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const userId = 'user-1';

        repo.seedTotals(userId, [
            { year: 2025, totalPaidCents: 120_000, paymentCount: 2 },
            { year: 2024, totalPaidCents: 600_000, paymentCount: 10 }
        ]);

        const useCase = new ListStudentPaidTotalsByYear(repo);
        const result = await useCase.exec({ userId });

        expect(result.totalsByYear).toHaveLength(2);
        expect(result.totalsByYear[0]).toEqual({
            year: 2025,
            totalPaidCents: 120_000,
            paymentCount: 2
        });
        expect(result.totalsByYear[1].year).toBe(2024);
    });

    it('returns empty list when userId is missing', async () => {
        const repo = new InMemoryFinancialChargeRepository();
        const useCase = new ListStudentPaidTotalsByYear(repo);

        const result = await useCase.exec({ userId: '   ' });
        expect(result.totalsByYear).toEqual([]);
    });

    it('returns empty list when repository does not support aggregation', async () => {
        const useCase = new ListStudentPaidTotalsByYear(new RepositoryWithoutTotals());
        const result = await useCase.exec({ userId: 'user-1' });
        expect(result.totalsByYear).toEqual([]);
    });
});
