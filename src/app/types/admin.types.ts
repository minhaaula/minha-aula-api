/**
 * Tipos relacionados ao módulo admin
 */

import type { SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';
import type { PostalAddressOutput } from './common.types';

/** Status da escola no sistema: ativo (com plano em uso) ou inativo */
export type SchoolStatus = 'ACTIVE' | 'INACTIVE';

/** Status de pagamento do plano: em dia, atrasado ou sem plano */
export type PaymentStatus = 'EM_DIA' | 'ATRASADO' | null;

export interface SchoolWithPlanItem {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string;
    addresses: PostalAddressOutput[];
    createdAt: Date;
    ownerName: string | null;
    ownerCpf: string | null;
    ownerEmail: string | null;
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
}

/**
 * Detalhes completos de uma escola para a área administrativa.
 * Estende as informações usadas na listagem (`SchoolWithPlanItem`)
 * com campos adicionais relevantes para suporte e operação.
 */
export interface AdminSchoolDetails extends SchoolWithPlanItem {
    incomeValue: number;
    ownerUserId: string | null;
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
     * True se a escola já tiver ao menos um pagamento concluído (invoice PAID).
     * False indica que ainda é o primeiro pagamento (ou que nunca pagou).
     */
    hasCompletedFirstPayment: boolean;
}

export interface AdminSchoolPlansResponse {
    currentPlan: SchoolPlanFinanceView | null;
    history: SchoolPlanFinanceView[];
}
