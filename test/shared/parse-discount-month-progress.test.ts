import { describe, expect, it } from 'vitest';
import {
    formatDiscountMonthsLabel,
    parseDiscountMonthProgress
} from '../../src/shared/parse-discount-month-progress';

describe('parseDiscountMonthProgress', () => {
    it('parses "1 de 3 meses" from discount reason', () => {
        const result = parseDiscountMonthProgress('Desconto aplicado (1 de 3 meses)', 5000);
        expect(result).toEqual({ label: '1 de 3', current: 1, total: 3 });
    });

    it('parses "3 de 10"', () => {
        const result = parseDiscountMonthProgress('Desconto aplicado (3 de 10 meses)', 1000);
        expect(result).toEqual({ label: '3 de 10', current: 3, total: 10 });
    });

    it('returns null when there is no discount', () => {
        expect(parseDiscountMonthProgress(null, null)).toBeNull();
        expect(parseDiscountMonthProgress('Desconto aplicado (1 de 2)', 0)).toBeNull();
    });

    it('returns null when reason has no progress pattern', () => {
        expect(parseDiscountMonthProgress('Bolsa parcial', 500)).toBeNull();
    });

    it('formatDiscountMonthsLabel appends meses', () => {
        const progress = parseDiscountMonthProgress('Desconto aplicado (1 de 2 meses)', 1000);
        expect(formatDiscountMonthsLabel(progress)).toBe('1 de 2 meses');
    });

    it('formatDiscountMonthsLabel uses singular mês', () => {
        const progress = parseDiscountMonthProgress('Desconto aplicado (1 de 1 meses)', 1000);
        expect(formatDiscountMonthsLabel(progress)).toBe('1 de 1 mês');
    });
});
