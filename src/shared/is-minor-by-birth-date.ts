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
