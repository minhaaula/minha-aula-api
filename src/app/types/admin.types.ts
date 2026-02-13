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
    schoolStatus: SchoolStatus;
    paymentStatus: PaymentStatus;
    plan: SchoolPlanFinanceView | null;
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
     */
    accountId: string | null;
    accountApiKey: string | null;
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
}

export interface AdminSchoolPlansResponse {
    currentPlan: SchoolPlanFinanceView | null;
    history: SchoolPlanFinanceView[];
}
