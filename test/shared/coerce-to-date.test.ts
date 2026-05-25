import { describe, expect, it } from 'vitest';
import { coerceToDate } from '../../src/shared/date-utils';
import { startOfLocalDay } from '../../src/app/use-cases/payments/resolve-next-tuition-due-date';

describe('coerceToDate', () => {
    it('converte string ISO em Date', () => {
        const d = coerceToDate('2026-05-22T12:00:00.000Z');
        expect(d).toBeInstanceOf(Date);
        expect(d?.getUTCFullYear()).toBe(2026);
    });

    it('retorna null para valor inválido', () => {
        expect(coerceToDate('')).toBeNull();
        expect(coerceToDate('invalid')).toBeNull();
    });
});

describe('startOfLocalDay com string', () => {
    it('não lança quando a data vem como string do banco', () => {
        const d = startOfLocalDay('2026-05-22');
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(4);
        expect(d.getDate()).toBe(22);
    });
});
