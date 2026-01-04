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
    links?: {
        facebook?: string | null;
        instagram?: string | null;
        tiktok?: string | null;
        youtube?: string | null;
        site?: string | null;
    };
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
    links: {
        facebook: string | null;
        instagram: string | null;
        tiktok: string | null;
        youtube: string | null;
        site: string | null;
    };
}

export interface SchoolSummary {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string;
    createdAt: Date;
}

export type BankAccountOutput = {
    id: string;
    bankName: string;
    bankCode?: number;
    bankAgency: string;
    bankAgencyDigit?: string;
    bankAccount: string;
    bankAccountDigit?: string;
    bankAccountType: 'CORRENTE' | 'POUPANCA';
    bankAccountHolderDocument: string;
    pixKey?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};

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
    bankAccounts: BankAccountOutput[];
    links: {
        facebook: string | null;
        instagram: string | null;
        tiktok: string | null;
        youtube: string | null;
        site: string | null;
    };
    images: Array<{
        id: string;
        url: string;
        key: string;
        contentType: string;
        originalFileName: string;
        category: string;
        createdAt: Date;
    }>;
    isOverdue?: boolean;
}

