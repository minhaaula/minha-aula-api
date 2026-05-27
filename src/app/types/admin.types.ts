/**
 * Tipos relacionados ao módulo admin
 */

import type { AdminSchoolAsaasAccountView } from '../presenters/admin-school-asaas-account.presenter';
import type { SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';
import type { PostalAddressOutput } from './common.types';
import type { SchoolProfileOnboarding } from './school.types';

/** Status da escola no sistema: ativo (com plano em uso) ou inativo */
export type SchoolStatus = 'ACTIVE' | 'INACTIVE';

/** Status da conta do aluno titular (users.active) ou do dependente (soft delete). */
export type StudentAccountStatus = 'ACTIVE' | 'INACTIVE';

export function presentStudentAccountStatus(active: boolean): StudentAccountStatus {
    return active ? 'ACTIVE' : 'INACTIVE';
}

export function presentDependentStudentStatus(deletedAt: Date | null): StudentAccountStatus {
    return deletedAt ? 'INACTIVE' : 'ACTIVE';
}

/** Status de pagamento do plano: em dia, atrasado ou sem plano */
export type PaymentStatus = 'EM_DIA' | 'ATRASADO' | null;

export interface SchoolWithPlanItem {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string | null;
    /** Associação sem fins lucrativos (exige CNPJ no cadastro). */
    isNonprofitAssociation: boolean;
    addresses: PostalAddressOutput[];
    createdAt: Date;
    ownerName: string | null;
    ownerCpf: string | null;
    ownerEmail: string | null;
    /** YYYY-MM-DD */
    ownerBirthDate: string | null;
    ownerWhatsapp: string | null;
    schoolStatus: SchoolStatus;
    paymentStatus: PaymentStatus;
    plan: SchoolPlanFinanceView | null;
    /** True se a escola já tiver ao menos um pagamento concluído (invoice PAID). */
    hasCompletedFirstPayment: boolean;
    /** Indica se o onboarding/KYC foi concluído (webhook de aprovação recebido). */
    onboardingCompleted: boolean;
    /** ID da subconta Asaas (null se ainda não criada). */
    accountId: string | null;
    /**
     * Status consolidado da conta Asaas (snapshot persistido; sem chamada ao provedor).
     * `null` quando não há subconta (`accountId` ausente).
     */
    asaasAccount: AdminSchoolAsaasAccountView | null;
    /** Matrículas ativas na escola (mesma regra do dashboard da escola). */
    studentCount: number;
    /** Cursos ativos (`is_active`, não excluídos). */
    courseCount: number;
    /** Turmas ativas. */
    classCount: number;
}

/**
 * Detalhes completos de uma escola para a área administrativa.
 * Estende as informações usadas na listagem (`SchoolWithPlanItem`)
 * com campos adicionais relevantes para suporte e operação.
 */
export interface AdminSchoolDetails extends SchoolWithPlanItem {
    /** URL assinada do logo da escola (categoria LOGO), ou null se não houver. */
    schoolLogo: string | null;
    incomeValue: number;
    ownerUserId: string | null;
    /** Se o dono pode usar login de aluno (null sem owner_user_id). */
    ownerStudentAccessEnabled: boolean | null;
    /**
     * Identificadores da conta no provedor de pagamentos (Asaas).
     * Podem ser nulos quando a conta ainda não foi criada/associada.
     * Nota: accountApiKey não é exposto (dado sensível, uso interno).
     */
    accountId: string | null;
    walletId: string | null;
    /**
     * Link de onboarding/KYC gerado pelo provedor (quando disponível).
     */
    onboardingUrl: string | null;
    /**
     * Indica se o onboarding já foi concluído (webhook de aprovação recebido).
     */
    onboardingCompleted: boolean;
    onboardingCompletedAt: Date | null;
    /**
     * Onboarding / KYC (Asaas), mesmo contrato do objeto `onboarding` em GET `/schools/me`.
     */
    onboarding: SchoolProfileOnboarding;
}

export interface AdminSchoolPlansResponse {
    currentPlan: SchoolPlanFinanceView | null;
    history: SchoolPlanFinanceView[];
}
