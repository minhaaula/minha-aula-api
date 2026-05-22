import type { User } from '../../../domain/entities/user';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AppError, ErrorCode } from '../../../shared/errors';

export const SCHOOL_PERSONA_STUDENT_PROFILE_ROUTES_MESSAGE =
    'Usuários com perfil de escola não podem alterar o próprio cadastro pelas rotas do aluno. ' +
    'Os dados estão vinculados ao KYC da subconta Asaas — altere pelo painel da escola (PATCH /schools/students/:id).';

/**
 * Impede qualquer alteração de perfil via rotas do app aluno quando o titular tem persona SCHOOL.
 */
export function assertSchoolPersonaCannotUseStudentProfileRoutes(user: User): void {
    if (user.persona !== UserPersonaEnum.SCHOOL) {
        return;
    }

    throw AppError.fromCode(ErrorCode.SCHOOL_PERSONA_STUDENT_PROFILE_UPDATE_FORBIDDEN, {
        message: SCHOOL_PERSONA_STUDENT_PROFILE_ROUTES_MESSAGE
    });
}
