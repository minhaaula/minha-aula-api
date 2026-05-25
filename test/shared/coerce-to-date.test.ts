import { describe, expect, it } from 'vitest';
import { coerceToDate } from '../../src/shared/date-utils';
import { startOfLocalDay } from '../../src/app/use-cases/payments/resolve-next-tuition-due-date';

describe('coerceToDate', () => {
    it('converte string ISO em Date', () => {
        const d = coerceToDate('2026-05-10T12:00:00.000Z');
        expect(d).toBeInstanceOf(Date);
        expect(d?.getUTCFullYear()).toBe(2026);
    });

    it('retorna null para valor inválido', () => {
        expect(coerceToDate('invalid')).toBeNull();
        expect(coerceToDate(null)).toBeNull();
    });
});

describe('startOfLocalDay', () => {
    it('aceita string sem lançar getFullYear is not a function', () => {
        const d = startOfLocalDay('2026-05-10T12:00:00.000Z');
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(4);
        expect(d.getDate()).toBe(10);
    });
});
