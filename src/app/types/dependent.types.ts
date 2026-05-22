/**
 * Tipos relacionados a dependentes
 */

import type { Gender } from '../../domain/value-objects/gender';

export interface AddDependentInput {
    ownerUserId: string;
    fullName: string;
    cpf?: string | null;
    birthDate?: string | null;
    relationship?: string | null;
    gender?: Gender | null;
}

export interface AddDependentOutput {
    id: string;
    userId: string;
    fullName: string;
    cpf: string | null;
    birthDate: Date | null;
    relationship: string | null;
    gender: Gender | null;
    createdAt: Date;
}

