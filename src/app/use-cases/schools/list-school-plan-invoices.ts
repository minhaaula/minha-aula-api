import { SchoolPlanFinanceRepository } from '../../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceRepository } from '../../../ports/repositories/school-plan-invoice.repo';
import { presentSchoolPlanInvoice, SchoolPlanInvoiceView } from '../../presenters/school-plan-invoice.presenter';

type ListSchoolPlanInvoicesInput = {
    schoolId: string;
};

export class ListSchoolPlanInvoices {
    constructor(
        private readonly finances: SchoolPlanFinanceRepository,
        private readonly invoices: SchoolPlanInvoiceRepository
    ) {}

    async exec(input: ListSchoolPlanInvoicesInput): Promise<{ invoices: SchoolPlanInvoiceView[] }> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) throw new Error('School id is required');

        const finance = await this.finances.findActiveBySchoolId(schoolId);
        if (!finance) {
            return { invoices: [] };
        }

        const items = await this.invoices.findByFinanceId(finance.id);
        return {
            invoices: items.map((invoice) => presentSchoolPlanInvoice(invoice))
        };
    }
}
