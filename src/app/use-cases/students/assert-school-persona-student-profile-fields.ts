import type { User } from '../../../domain/entities/user';
import type { Gender } from '../../../domain/value-objects/gender';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AppError, ErrorCode } from '../../../shared/errors';

const LOCKED_FIELDS_MESSAGE =
    'Usuários com perfil de escola não podem alterar nome, CPF, data de nascimento nem sexo pelas rotas do aluno';

export type SchoolPersonaLockedProfileFields = {
    fullName?: string;
    cpf?: string | null;
    birthDate?: string | null;
    gender?: Gender | null;
};

/** Bloqueia campos de identidade quando o titular tem persona SCHOOL (acesso aluno via flag). */
export function assertSchoolPersonaCanUpdateStudentProfileFields(
    user: User,
    input: SchoolPersonaLockedProfileFields
): void {
    if (user.persona !== UserPersonaEnum.SCHOOL) {
        return;
    }

    const lockedFields: string[] = [];
    if (input.fullName !== undefined) lockedFields.push('fullName');
    if (input.cpf !== undefined) lockedFields.push('cpf');
    if (input.birthDate !== undefined) lockedFields.push('birthDate');
    if (input.gender !== undefined) lockedFields.push('gender');

    if (lockedFields.length === 0) {
        return;
    }

    throw AppError.fromCode(ErrorCode.SCHOOL_OWNER_STUDENT_PROFILE_FIELD_LOCKED, {
        message: LOCKED_FIELDS_MESSAGE,
        fields: lockedFields
    });
}
