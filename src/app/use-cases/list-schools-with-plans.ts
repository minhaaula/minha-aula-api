import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { presentSchoolPlanFinance, type SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';
import type { SchoolWithPlanItem, SchoolStatus, PaymentStatus } from '../types/admin.types';

/** Escola sem primeiro pagamento E sem onboarding completo não pode ser ACTIVE. INACTIVE quando pediu encerramento (quando existir campo). */
function deriveSchoolStatus(
    planView: SchoolPlanFinanceView | null,
    hasCompletedFirstPayment: boolean,
    onboardingCompleted: boolean
): SchoolStatus {
    const hasFirstPaymentOrOnboarding = hasCompletedFirstPayment || onboardingCompleted;
    if (!hasFirstPaymentOrOnboarding) return 'INACTIVE';
    if (!planView) return 'INACTIVE';
    return planView.status === 'ACTIVE' || planView.status === 'TRIAL' ? 'ACTIVE' : 'INACTIVE';
}

function derivePaymentStatus(planView: SchoolPlanFinanceView | null): PaymentStatus {
    if (!planView) return null;
    if (planView.status === 'ACTIVE' || planView.status === 'TRIAL') return 'EM_DIA';
    if (planView.status === 'PAST_DUE' || planView.status === 'SUSPENDED' || planView.status === 'CANCELLED') return 'ATRASADO';
    return null;
}

/** Filtro binário: WITH = tem, WITHOUT = não tem */
export type WithWithoutFilter = 'WITH' | 'WITHOUT';

/** Filtro sim/não: YES = sim, NO = não */
export type YesNoFilter = 'YES' | 'NO';

export type ListSchoolsWithPlansInput = {
    name?: string | null;
    status?: SchoolStatus | null;
    paymentStatus?: 'EM_DIA' | 'ATRASADO' | null;
    /** Filtro por CNPJ (busca parcial, ignora formatação) */
    cnpj?: string | null;
    /** Filtro por CPF do titular (busca parcial, ignora formatação) */
    ownerCpf?: string | null;
    /** Filtro por conta Asaas: WITH = tem conta, WITHOUT = sem conta */
    hasAsaasAccount?: WithWithoutFilter | null;
    /** Filtro por onboardingUrl: WITH = tem URL, WITHOUT = não tem */
    hasOnboardingUrl?: WithWithoutFilter | null;
    /** Filtro por primeiro pagamento: YES = já fez, NO = ainda não fez */
    firstPayment?: YesNoFilter | null;
    /** Filtro por onboarding concluído: YES = concluído, NO = pendente */
    onboarding?: YesNoFilter | null;
    limit?: number;
    offset?: number;
};

export type ListSchoolsWithPlansOutput = {
    schools: SchoolWithPlanItem[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        totalPage: number;
        currentPage: number;
        hasMore: boolean;
    };
};

export class ListSchoolsWithPlans {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly planFinances: SchoolPlanFinanceRepository,
        private readonly planInvoices: SchoolPlanInvoiceRepository
    ) {}

    async exec(input?: ListSchoolsWithPlansInput): Promise<ListSchoolsWithPlansOutput> {
        const nameFilter = input?.name?.trim().toLowerCase() || null;
        const statusFilter = input?.status ?? null;
        const paymentStatusFilter = input?.paymentStatus ?? null;
        const cnpjFilter = input?.cnpj?.trim().replace(/\D/g, '') || null;
        const ownerCpfFilter = input?.ownerCpf?.trim().replace(/\D/g, '') || null;
        const hasAsaasAccountFilter = input?.hasAsaasAccount ?? null;
        const hasOnboardingUrlFilter = input?.hasOnboardingUrl ?? null;
        const firstPaymentFilter = input?.firstPayment ?? null;
        const onboardingFilter = input?.onboarding ?? null;
        const limit = Math.min(Math.max(input?.limit ?? 50, 1), 500);
        const offset = Math.max(0, input?.offset ?? 0);

        const allSchools = await this.schools.findAll();
        const [planFinancesMap, paidSchoolIds] = await Promise.all([
            this.loadPlanFinancesMap(allSchools.map((s) => s.id)),
            this.planInvoices.getSchoolIdsWithPaidInvoice(allSchools.map((s) => s.id))
        ]);

        let items: SchoolWithPlanItem[] = allSchools.map((school) => {
            const plan = planFinancesMap.get(school.id) ?? null;
            const hasCompletedFirstPayment = paidSchoolIds.has(school.id);
            const onboardingCompleted = school.onboardingCompletedAt !== null;
            return {
                id: school.id,
                name: school.name,
                email: school.email,
                phone: school.phone,
                cnpj: school.cnpj,
                addresses: school.addresses.map((address) => address.toPrimitives()),
                createdAt: school.createdAt,
                ownerName: school.ownerName,
                ownerCpf: school.ownerCpf,
                ownerEmail: school.ownerEmail,
                schoolStatus: deriveSchoolStatus(plan, hasCompletedFirstPayment, onboardingCompleted),
                paymentStatus: derivePaymentStatus(plan),
                plan,
                hasCompletedFirstPayment,
                onboardingCompleted,
                accountId: school.accountId
            };
        });

        if (nameFilter) {
            items = items.filter((s) => s.name.toLowerCase().includes(nameFilter));
        }
        if (statusFilter) {
            items = items.filter((s) => s.schoolStatus === statusFilter);
        }
        if (paymentStatusFilter) {
            items = items.filter((s) => s.paymentStatus === paymentStatusFilter);
        }
        if (cnpjFilter) {
            const cnpjDigits = cnpjFilter.replace(/\D/g, '');
            items = items.filter((s) => (s.cnpj?.replace(/\D/g, '') ?? '').includes(cnpjDigits));
        }
        if (ownerCpfFilter) {
            const cpfDigits = ownerCpfFilter.replace(/\D/g, '');
            items = items.filter((s) => (s.ownerCpf?.replace(/\D/g, '') ?? '').includes(cpfDigits));
        }
        if (hasAsaasAccountFilter) {
            items = items.filter((s) =>
                hasAsaasAccountFilter === 'WITH'
                    ? Boolean(s.accountId?.trim())
                    : !s.accountId?.trim()
            );
        }
        if (hasOnboardingUrlFilter) {
            items = items.filter((s) => {
                const school = allSchools.find((sc) => sc.id === s.id);
                const hasUrl = Boolean(school?.onboardingUrl?.trim());
                return hasOnboardingUrlFilter === 'WITH' ? hasUrl : !hasUrl;
            });
        }
        if (firstPaymentFilter) {
            items = items.filter((s) =>
                firstPaymentFilter === 'YES' ? s.hasCompletedFirstPayment : !s.hasCompletedFirstPayment
            );
        }
        if (onboardingFilter) {
            items = items.filter((s) =>
                onboardingFilter === 'YES' ? s.onboardingCompleted : !s.onboardingCompleted
            );
        }

        const total = items.length;
        // Mais recentes primeiro; depois ordenação por nome para consistência
        const sorted = items.sort((a, b) => {
            const dateA = a.createdAt.getTime();
            const dateB = b.createdAt.getTime();
            if (dateB !== dateA) return dateB - dateA;
            return a.name.localeCompare(b.name, 'pt-BR');
        });
        const schools = sorted.slice(offset, offset + limit);

        return {
            schools,
            pagination: {
                total,
                limit,
                offset,
                totalPage: Math.ceil(total / limit) || 1,
                currentPage: Math.floor(offset / limit) + 1,
                hasMore: offset + limit < total
            }
        };
    }

    private async loadPlanFinancesMap(schoolIds: string[]): Promise<Map<string, SchoolPlanFinanceView>> {
        const map = new Map<string, SchoolPlanFinanceView>();

        // Buscar planos financeiros para todas as escolas de uma vez
        const planFinances = await this.planFinances.findAllBySchoolIds(schoolIds);

        for (const finance of planFinances) {
            map.set(finance.schoolId, presentSchoolPlanFinance(finance));
        }

        return map;
    }
}

