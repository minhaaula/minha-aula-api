/**
 * Tipos relacionados a autenticação e usuários
 */

import { UserPersona } from '../../domain/value-objects/user-persona';
import type { PostalAddressInput, PostalAddressOutput } from './common.types';

export interface RegisterUserInput {
    fullName: string;
    birthDate: string;
    email: string;
    phone: string;
    cpf: string;
    address: PostalAddressInput;
    persona: UserPersona;
    password: string;
}

export interface RegisterUserOutput {
    userId: string;
    fullName: string;
    email: string;
    cpf: string;
    persona: UserPersona;
    createdAt: Date;
}

export interface LoginUserInput {
    email: string;
    password: string;
}

export interface LoginUserOutput {
    token: string;
    user: {
        id: string;
        fullName: string;
        email: string;
        cpf: string;
        persona: UserPersona;
        schoolId?: string | null;
    };
}

export interface UpdateUserPasswordInput {
    userId: string;
    currentPassword: string;
    newPassword: string;
}

export interface UpdateUserPasswordOutput {
    success: boolean;
}

