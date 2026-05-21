import { User } from '../domain/entities/user';
import { UserPersona, UserPersonaEnum } from '../domain/value-objects/user-persona';

/** Indica se o usuário pode usar fluxos de aluno (app/login de estudante). */
export function canActAsStudent(user: User): boolean {
    if (user.persona === UserPersonaEnum.STUDENT) {
        return true;
    }
    if (user.persona === UserPersonaEnum.SCHOOL) {
        return user.studentAccessEnabled;
    }
    return false;
}

/**
 * Persona efetiva no token de acesso ao app de aluno.
 * Donos de escola com flag ativa recebem STUDENT no JWT sem alterar o cadastro.
 */
export function resolveStudentLoginTokenPersona(user: User): UserPersona {
    if (user.persona === UserPersonaEnum.SCHOOL && user.studentAccessEnabled) {
        return UserPersonaEnum.STUDENT;
    }
    return user.persona;
}
