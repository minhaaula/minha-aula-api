import { AppError, ErrorCode } from './errors';

/**
 * Considera menor de idade quem tem menos de 18 anos completos na data de referência.
 */
export function isMinorByBirthDate(
    birthDate: Date | null | undefined,
    referenceDate: Date = new Date()
): boolean {
    if (!birthDate) return false;
    const ref = new Date(referenceDate);
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return false;

    let age = ref.getFullYear() - birth.getFullYear();
    const monthDiff = ref.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
        age -= 1;
    }
    return age < 18;
}

/** Titular (conta STUDENT) não pode ser menor de 18 anos; dependentes podem. */
export function assertTitularMinimumAge(
    birthDate: Date,
    referenceDate: Date = new Date()
): void {
    if (isMinorByBirthDate(birthDate, referenceDate)) {
        throw AppError.fromCode(ErrorCode.STUDENT_UNDERAGE_NOT_ALLOWED, {
            birthDate: birthDate.toISOString().slice(0, 10)
        });
    }
}
