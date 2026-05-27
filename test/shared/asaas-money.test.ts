import { describe, expect, it } from 'vitest';
import { parseAsaasReaisToCents } from '../../src/shared/asaas-money';

describe('parseAsaasReaisToCents', () => {
    it('converte number em centavos', () => {
        expect(parseAsaasReaisToCents(29.01)).toBe(2901);
    });

    it('converte string em centavos', () => {
        expect(parseAsaasReaisToCents('29.01')).toBe(2901);
        expect(parseAsaasReaisToCents('29,01')).toBe(2901);
    });

    it('retorna null para valor inválido', () => {
        expect(parseAsaasReaisToCents(null)).toBeNull();
        expect(parseAsaasReaisToCents('abc')).toBeNull();
    });
});
