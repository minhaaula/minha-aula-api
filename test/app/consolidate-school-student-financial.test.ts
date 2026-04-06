import { describe, expect, it } from 'vitest';
import { aggregateStudentChargeAmounts } from '../../src/app/use-cases/consolidate-school-student-financial';

describe('aggregateStudentChargeAmounts', () => {
    it('separa pago, pendente, atrasado e inclui cancelado só no grand total', () => {
        const d = (s: string) => new Date(s);
        const result = aggregateStudentChargeAmounts([
            { netAmountCents: 10_000, status: 'PAID', dueDate: d('2025-01-01') },
            { netAmountCents: 5_000, status: 'OPEN', dueDate: d('2030-01-01') },
            { netAmountCents: 3_000, status: 'OPEN', dueDate: d('2020-01-01') },
            { netAmountCents: 2_000, status: 'OVERDUE', dueDate: d('2025-06-01') },
            { netAmountCents: 7_000, status: 'CANCELLED', dueDate: d('2025-01-01') }
        ]);

        expect(result.paidTotalCents).toBe(10_000);
        expect(result.pendingTotalCents).toBe(5_000);
        expect(result.overdueTotalCents).toBe(5_000);
        expect(result.grandTotalCents).toBe(27_000);
    });

    it('FAILED vencido vai para atrasado; FAILED não vencido para pendente', () => {
        const d = (s: string) => new Date(s);
        const result = aggregateStudentChargeAmounts([
            { netAmountCents: 1_000, status: 'FAILED', dueDate: d('2030-01-01') },
            { netAmountCents: 2_000, status: 'FAILED', dueDate: d('2010-01-01') }
        ]);

        expect(result.pendingTotalCents).toBe(1_000);
        expect(result.overdueTotalCents).toBe(2_000);
        expect(result.paidTotalCents).toBe(0);
        expect(result.grandTotalCents).toBe(3_000);
    });
});
