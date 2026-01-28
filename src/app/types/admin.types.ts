/**
 * Tipos relacionados ao módulo admin
 */

import type { SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';
import type { PostalAddressOutput } from './common.types';

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
    incomeValue: number;
    plan: SchoolPlanFinanceView | null;
}

/**
 * Detalhes completos de uma escola para a área administrativa.
 * Estende as informações usadas na listagem (`SchoolWithPlanItem`)
 * com campos adicionais relevantes para suporte e operação.
 */
export interface AdminSchoolDetails extends SchoolWithPlanItem {
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

