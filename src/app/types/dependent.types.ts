/**
 * Tipos relacionados a dependentes
 */

export interface AddDependentInput {
    ownerUserId: string;
    fullName: string;
    cpf?: string | null;
    birthDate?: string | null;
    relationship?: string | null;
}

export interface AddDependentOutput {
    id: string;
    userId: string;
    fullName: string;
    cpf: string | null;
    birthDate: Date | null;
    relationship: string | null;
    createdAt: Date;
}

