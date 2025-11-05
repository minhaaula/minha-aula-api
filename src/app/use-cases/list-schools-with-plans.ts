import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { presentSchoolPlanFinance, type SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';
import type { SchoolWithPlanItem } from '../types/admin.types';

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
        return schools.map((school) => ({
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
            incomeValue: school.incomeValue,
            plan: planFinancesMap.get(school.id) ?? null
        }));
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

