/**
 * Textos de cobrança para UI da escola (lista de pagamentos, ficha do aluno, admin).
 * Cobranças antigas podem ter descrição em inglês ("Enrollment fee"); para ENROLLMENT
 * sempre derivamos do nome do curso.
 */
export function formatEnrollmentChargeDescription(courseName: string): string {
    const name = courseName.trim() || 'Curso';
    return `Matrícula do curso ${name}`;
}

export function formatSchoolChargeDescriptionForSchoolUi(
    chargeType: string,
    storedDescription: string | null | undefined,
    courseName: string | null | undefined
): string {
    if (chargeType === 'ENROLLMENT') {
        return formatEnrollmentChargeDescription(courseName ?? '');
    }
    return storedDescription ?? '';
}
