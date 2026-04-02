import { describe, expect, it } from 'vitest';
import { isOpenChargeCalendarOverdue } from '../../src/shared/billing-due-date';

describe('isOpenChargeCalendarOverdue', () => {
    it('não marca atrasado no mesmo dia civil BR quando o instante UTC já é o dia seguinte (~21h+ BR)', () => {
        const now = new Date('2026-06-10T02:00:00.000Z');
        const due = new Date('2026-06-09T00:00:00.000Z');
        expect(isOpenChargeCalendarOverdue(due, now, 'America/Sao_Paulo')).toBe(false);
    });

    it('marca atrasado quando o dia civil BR já passou em relação ao vencimento (UTC)', () => {
        const now = new Date('2026-06-11T12:00:00.000Z');
        const due = new Date('2026-06-09T00:00:00.000Z');
        expect(isOpenChargeCalendarOverdue(due, now, 'America/Sao_Paulo')).toBe(true);
    });

    it('não está atrasado quando vencimento e hoje são o mesmo dia civil BR', () => {
        const now = new Date('2026-03-15T23:30:00.000Z');
        const due = new Date('2026-03-15T00:00:00.000Z');
        expect(isOpenChargeCalendarOverdue(due, now, 'America/Sao_Paulo')).toBe(false);
    });
});
