import { UserPersona } from '../../domain/value-objects/user-persona';

export interface AuthTokenPayload {
    sub: string;
    cpf: string;
    fullName: string;
    email: string;
    persona: UserPersona;
    schoolId?: string;
    [key: string]: unknown;
}
