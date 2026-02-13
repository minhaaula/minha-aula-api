import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export type GetAdminSchoolBillingInput = {
    schoolId: string;
    monthsLimit?: number;
};

export type AdminSchoolBillingSummary = {
    totalGanhoCents: number;
    pendenteCents: number;
    atrasadoCents: number;
    saldoAtualCents: number;
};

export type AdminSchoolBillingMonthItem = {
    year: number;
    month: number;
    monthLabel: string;
    ganhoCents: number;
    pendenteCents: number;
    atrasadoCents: number;
    totalCents: number;
};

export type GetAdminSchoolBillingOutput = {
    schoolId: string;
    summary: AdminSchoolBillingSummary;
    consolidatedByMonth: AdminSchoolBillingMonthItem[];
};

export class GetAdminSchoolBilling {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly financialCharges: SchoolFinancialChargeRepository
    ) {}

    async exec(input: GetAdminSchoolBillingInput): Promise<GetAdminSchoolBillingOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw new Error('School id is required');
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw new Error('School not found');
        }

        const monthsLimit = Math.min(Math.max(input.monthsLimit ?? 12, 1), 60);

        let totalGanhoCents = 0;
        let pendenteCents = 0;
        let atrasadoCents = 0;

        if (this.financialCharges.findPaidChargesBySchoolId) {
            const paid = await this.financialCharges.findPaidChargesBySchoolId(schoolId);
            totalGanhoCents = paid.reduce((s, c) => s + c.netAmountCents, 0);
        }
        if (this.financialCharges.getPendingSummary) {
            const p = await this.financialCharges.getPendingSummary(schoolId);
            pendenteCents = p.totalAmountCents;
        }
        if (this.financialCharges.getOverdueSummary) {
            const o = await this.financialCharges.getOverdueSummary(schoolId);
            atrasadoCents = o.totalAmountCents;
        }

        const summary: AdminSchoolBillingSummary = {
            totalGanhoCents,
            pendenteCents,
            atrasadoCents,
            saldoAtualCents: totalGanhoCents
        };

        let consolidatedByMonth: AdminSchoolBillingMonthItem[] = [];
        if (this.financialCharges.getBillingConsolidatedByMonth) {
            const rows = await this.financialCharges.getBillingConsolidatedByMonth(schoolId, monthsLimit);
            consolidatedByMonth = rows.map((r) => ({
                year: r.year,
                month: r.month,
                monthLabel: `${MONTH_NAMES[r.month - 1]}/${r.year}`,
                ganhoCents: r.ganhoCents,
                pendenteCents: r.pendenteCents,
                atrasadoCents: r.atrasadoCents,
                totalCents: r.totalCents
            }));
        }

        return {
            schoolId,
            summary,
            consolidatedByMonth
        };
    }
}
