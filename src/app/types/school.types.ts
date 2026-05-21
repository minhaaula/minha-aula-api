/**
 * Tipos relacionados a escolas
 */

import type { PostalAddressInput, PostalAddressOutput } from './common.types';

export interface CreateSchoolInput {
    name: string;
    email: string;
    phone: string;
    cnpj?: string | null;
    incomeValue?: number;
    addresses?: PostalAddressInput[];
    ownerUserId?: string | null;
    ownerName?: string | null;
    ownerCpf?: string | null;
    ownerEmail?: string | null;
    /** Data de nascimento do titular (YYYY-MM-DD). Obrigatória quando não há CNPJ. */
    ownerBirthDate?: string | null;
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
    cnpj: string | null;
    addresses: PostalAddressOutput[];
    createdAt: Date;
    ownerUserId: string | null;
    ownerName: string | null;
    ownerCpf: string | null;
    ownerEmail: string | null;
    /** YYYY-MM-DD */
    ownerBirthDate: string | null;
    ownerWhatsapp: string | null;
    incomeValue: number;
    kycUrl?: string | null;
}

export interface UpdateSchoolInput {
    schoolId: string;
    name?: string;
    email?: string;
    phone?: string;
    cnpj?: string | null;
    addresses?: PostalAddressInput[];
    ownerName?: string | null;
    ownerCpf?: string | null;
    ownerEmail?: string | null;
    ownerBirthDate?: string | null;
    ownerWhatsapp?: string | null;
    ownerUserId?: string | null;
    ownerPassword?: string | null;
    /** Habilita login no app de aluno para o usuário dono (persona SCHOOL). */
    ownerStudentAccessEnabled?: boolean;
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
    cnpj: string | null;
    addresses: PostalAddressOutput[];
    createdAt: Date;
    ownerUserId: string | null;
    ownerName: string | null;
    ownerCpf: string | null;
    ownerEmail: string | null;
    /** YYYY-MM-DD */
    ownerBirthDate: string | null;
    ownerWhatsapp: string | null;
    incomeValue: number;
    links: {
        facebook: string | null;
        instagram: string | null;
        tiktok: string | null;
        youtube: string | null;
        site: string | null;
    };
    ownerStudentAccessEnabled: boolean | null;
}

export interface SchoolSummary {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string | null;
    createdAt: Date;
    /** YYYY-MM-DD */
    ownerBirthDate?: string | null;
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

/** Status cadastral Asaas (GET /v3/myAccount/status) exposto no perfil da escola e espelhado no admin. */
export type SchoolProfileAsaasOnboardingStatus = {
    id: string;
    commercialInfo: string;
    bankAccountInfo: string;
    documentation: string;
    general: string;
    onboardingCompletedAt: Date | null;
    /** Último evento ACCOUNT_STATUS_* processado (quando disponível via snapshot). */
    lastEvent?: string | null;
    /** ISO timestamp do último evento processado (quando disponível via snapshot). */
    lastEventAt?: string | null;
};

/**
 * Objeto `onboarding` do GET `/schools/me`.
 * Mantido igual no detalhe admin para o painel espelhar a mesma estrutura.
 */
export type SchoolProfileOnboarding = {
    completed: boolean;
    url: string | null;
    accountId: string | null;
    hasCompletedFirstPayment: boolean;
    asaasStatus: SchoolProfileAsaasOnboardingStatus | null;
};

export interface GetSchoolProfileOutput {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string | null;
    addresses: PostalAddressOutput[];
    createdAt: Date;
    ownerUserId: string | null;
    ownerName: string | null;
    ownerCpf: string | null;
    ownerEmail: string | null;
    /** YYYY-MM-DD */
    ownerBirthDate: string | null;
    ownerWhatsapp: string | null;
    ownerStudentAccessEnabled: boolean | null;
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
    onboarding: SchoolProfileOnboarding;
}

/**
 * SID do template Twilio Content (WhatsApp) para envio de OTP.
 * Variáveis de ambiente: `TWILIO_CONTENT_SID_MESSAGE_OPT_IN` ou `TWILIO_WHATSAPP_MESSAGE_OPT_IN_CONTENT_SID`.
 * O template deve expor pelo menos o placeholder {{1}} com o texto do OTP gerado pela API.
 */
export interface SchoolActionOtpWhatsAppTemplateConfig {
    contentSid: string;
}

