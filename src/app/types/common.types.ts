/**
 * Tipos comuns reutilizáveis entre use cases
 */

export interface PostalAddressInput {
    street: string;
    number: string;
    complement?: string | null;
    district?: string | null;
    city: string;
    state: string;
    zipCode: string;
}

export interface PostalAddressOutput {
    street: string;
    number: string;
    complement?: string | null;
    district?: string | null;
    city: string;
    state: string;
    zipCode: string;
}

