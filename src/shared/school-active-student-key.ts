/**
 * Chave de aluno distinto por escola — mesma regra de `ListSchoolStudents` (admin)
 * e `EnrollmentRepositoryAdapter.countActiveBySchoolId(s)`.
 */
export type SchoolActiveStudentKeyInput = {
    studentType: 'USER' | 'DEPENDENT';
    studentUserId: string | null;
    ownerUserId: string;
    dependentId: string | null;
    dependentDeletedAt: Date | null;
};

/** `null` = matrícula não entra na contagem/listagem admin. */
export function resolveSchoolActiveStudentKey(input: SchoolActiveStudentKeyInput): string | null {
    const isDependentEnrollment =
        input.studentType === 'DEPENDENT' && Boolean(input.dependentId);

    if (isDependentEnrollment) {
        if (input.dependentDeletedAt != null) {
            return null;
        }
        return `dep:${input.dependentId}`;
    }

    return `user:${input.studentUserId ?? input.ownerUserId}`;
}
