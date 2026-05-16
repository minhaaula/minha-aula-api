import { describe, expect, it } from 'vitest';
import { sortSchoolChargesByDisplayStatusAndDueDate } from '../../src/shared/school-charge-list-order';

describe('sortSchoolChargesByDisplayStatusAndDueDate', () => {
    it('orders Atrasado, then Pendente, then others, then by due date desc', () => {
        const items = [
            { statusDisplay: 'Pago' as const, dueDate: new Date('2026-06-01'), paidAt: new Date('2026-05-20') },
            { statusDisplay: 'Pendente' as const, dueDate: new Date('2026-05-25'), paidAt: null },
            { statusDisplay: 'Atrasado' as const, dueDate: new Date('2026-05-10'), paidAt: null },
            { statusDisplay: 'Atrasado' as const, dueDate: new Date('2026-05-05'), paidAt: null },
            { statusDisplay: 'Pendente' as const, dueDate: new Date('2026-06-15'), paidAt: null }
        ];

        const sorted = sortSchoolChargesByDisplayStatusAndDueDate(items);

        expect(sorted.map((i) => i.statusDisplay)).toEqual([
            'Atrasado',
            'Atrasado',
            'Pendente',
            'Pendente',
            'Pago'
        ]);
        expect(sorted[0].dueDate.toISOString().slice(0, 10)).toBe('2026-05-10');
        expect(sorted[1].dueDate.toISOString().slice(0, 10)).toBe('2026-05-05');
        expect(sorted[2].dueDate.toISOString().slice(0, 10)).toBe('2026-06-15');
    });
});
