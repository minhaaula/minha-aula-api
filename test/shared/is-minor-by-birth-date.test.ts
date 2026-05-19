import { describe, expect, it } from 'vitest';
import { isMinorByBirthDate } from '../../src/shared/is-minor-by-birth-date';

describe('isMinorByBirthDate', () => {
    it('retorna true para menor de 18 anos', () => {
        const ref = new Date('2026-05-19');
        const birth = new Date('2010-06-01');
        expect(isMinorByBirthDate(birth, ref)).toBe(true);
    });

    it('retorna false para 18 anos ou mais', () => {
        const ref = new Date('2026-05-19');
        const birth = new Date('2008-05-18');
        expect(isMinorByBirthDate(birth, ref)).toBe(false);
    });

    it('retorna false quando birthDate é null', () => {
        expect(isMinorByBirthDate(null)).toBe(false);
    });
});
