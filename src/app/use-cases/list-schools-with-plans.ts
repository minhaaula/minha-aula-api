import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { presentSchoolPlanFinance, type SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';
import type { SchoolWithPlanItem, SchoolStatus, PaymentStatus } from '../types/admin.types';

function deriveSchoolStatus(planView: SchoolPlanFinanceView | null): SchoolStatus {
    if (!planView) return 'INACTIVE';
    return planView.status === 'ACTIVE' || planView.status === 'TRIAL' ? 'ACTIVE' : 'INACTIVE';
}

function derivePaymentStatus(planView: SchoolPlanFinanceView | null): PaymentStatus {
    if (!planView) return null;
    if (planView.status === 'ACTIVE' || planView.status === 'TRIAL') return 'EM_DIA';
    if (planView.status === 'PAST_DUE' || planView.status === 'SUSPENDED' || planView.status === 'CANCELLED') return 'ATRASADO';
    return null;
}

export type ListSchoolsWithPlansInput = {
    name?: string | null;
    status?: SchoolStatus | null;
    paymentStatus?: 'EM_DIA' | 'ATRASADO' | null;
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
        private readonly planFinances: SchoolPlanFinanceRepository
    ) {}

    async exec(input?: ListSchoolsWithPlansInput): Promise<ListSchoolsWithPlansOutput> {
        const nameFilter = input?.name?.trim().toLowerCase() || null;
        const statusFilter = input?.status ?? null;
        const paymentStatusFilter = input?.paymentStatus ?? null;
        const limit = Math.min(Math.max(input?.limit ?? 50, 1), 500);
        const offset = Math.max(0, input?.offset ?? 0);

        const allSchools = await this.schools.findAll();
        const planFinancesMap = await this.loadPlanFinancesMap(allSchools.map((s) => s.id));

        let items: SchoolWithPlanItem[] = allSchools.map((school) => {
            const plan = planFinancesMap.get(school.id) ?? null;
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
                schoolStatus: deriveSchoolStatus(plan),
                paymentStatus: derivePaymentStatus(plan),
                plan
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

        const total = items.length;
        const sorted = items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
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

