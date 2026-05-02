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
    /** Celular WhatsApp do responsável (somente dígitos). */
    ownerWhatsapp?: string | null;
    /** Token emitido após validação do OTP via WhatsApp (cadastro de escola). */
    ownerWhatsappVerificationToken: string;
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
    ownerWhatsapp: string | null;
    incomeValue: number;
    kycUrl?: string | null;
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
    ownerWhatsapp?: string | null;
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
    ownerWhatsapp: string | null;
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
    ownerWhatsapp: string | null;
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
    /** Onboarding / KYC (Asaas), URL e flags relacionadas. */
    onboarding: import('../use-cases/get-school-profile').SchoolProfileOnboarding;
}

/**
 * SID do template Twilio Content (WhatsApp) para envio de OTP.
 * Variáveis de ambiente: `TWILIO_CONTENT_SID_MESSAGE_OPT_IN` ou `TWILIO_WHATSAPP_MESSAGE_OPT_IN_CONTENT_SID`.
 * O template deve expor pelo menos o placeholder {{1}} com o texto do OTP gerado pela API.
 */
export interface SchoolActionOtpWhatsAppTemplateConfig {
    contentSid: string;
}

