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

export class ListSchoolsWithPlans {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly planFinances: SchoolPlanFinanceRepository
    ) {}

    async exec(): Promise<SchoolWithPlanItem[]> {
        // Buscar todas as escolas
        const schools = await this.schools.findAll();

        // Buscar todos os planos financeiros de uma vez
        const planFinancesMap = await this.loadPlanFinancesMap(schools.map((s) => s.id));

        // Combinar escolas com seus planos
        return schools.map((school) => {
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

