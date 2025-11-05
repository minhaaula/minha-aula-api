/**
 * Tipos relacionados a escolas
 */

import type { PostalAddressInput, PostalAddressOutput } from './common.types';

export interface CreateSchoolInput {
    name: string;
    email: string;
    phone: string;
    cnpj: string;
    incomeValue?: number;
    addresses?: PostalAddressInput[];
    ownerUserId?: string | null;
    ownerName?: string | null;
    ownerCpf?: string | null;
    ownerEmail?: string | null;
    ownerPassword?: string | null;
}

export interface CreateSchoolOutput {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string;
    addresses: PostalAddressOutput[];
    createdAt: Date;
    ownerUserId: string | null;
    ownerName: string | null;
    ownerCpf: string | null;
    ownerEmail: string | null;
    incomeValue: number;
}

export interface UpdateSchoolInput {
    schoolId: string;
    name?: string;
    email?: string;
    phone?: string;
    cnpj?: string;
    addresses?: PostalAddressInput[];
    ownerName?: string | null;
    ownerCpf?: string | null;
    ownerEmail?: string | null;
    ownerUserId?: string | null;
    ownerPassword?: string | null;
    incomeValue?: number;
}

export interface UpdateSchoolOutput {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string;
    addresses: PostalAddressOutput[];
    createdAt: Date;
    ownerUserId: string | null;
    ownerName: string | null;
    ownerCpf: string | null;
    ownerEmail: string | null;
    incomeValue: number;
}

export interface SchoolSummary {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string;
    createdAt: Date;
}

export interface GetSchoolProfileOutput {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string;
    addresses: PostalAddressOutput[];
    createdAt: Date;
    ownerUserId: string | null;
    ownerName: string | null;
    ownerCpf: string | null;
    ownerEmail: string | null;
    incomeValue: number;
}

