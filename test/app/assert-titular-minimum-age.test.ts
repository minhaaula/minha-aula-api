import { describe, expect, it } from 'vitest';
import { assertTitularMinimumAge, isMinorByBirthDate } from '../../src/shared/is-minor-by-birth-date';
import { AppError, ErrorCode } from '../../src/shared/errors';

describe('assertTitularMinimumAge', () => {
    it('identifica menor de 18 anos', () => {
        expect(isMinorByBirthDate(new Date('2010-06-01'), new Date('2026-05-23'))).toBe(true);
    });

    it('considera 18 anos completos como maior de idade', () => {
        expect(isMinorByBirthDate(new Date('2008-05-23'), new Date('2026-05-23'))).toBe(false);
    });

    it('lança STUDENT_UNDERAGE_NOT_ALLOWED para titular menor', () => {
        expect(() => assertTitularMinimumAge(new Date('2015-01-01'))).toThrow(AppError);
        try {
            assertTitularMinimumAge(new Date('2015-01-01'));
        } catch (error) {
            expect((error as AppError).code).toBe(ErrorCode.STUDENT_UNDERAGE_NOT_ALLOWED);
        }
    });
});
