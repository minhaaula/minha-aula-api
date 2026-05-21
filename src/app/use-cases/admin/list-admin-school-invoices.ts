import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { SchoolPlanInvoiceRepository } from '../../../ports/repositories/school-plan-invoice.repo';
import { presentSchoolPlanInvoice, type SchoolPlanInvoiceView } from '../../presenters/school-plan-invoice.presenter';

export type ListAdminSchoolInvoicesInput = {
    schoolId: string;
};

export type ListAdminSchoolInvoicesOutput = {
    schoolId: string;
    invoices: SchoolPlanInvoiceView[];
};

export class ListAdminSchoolInvoices {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly invoices: SchoolPlanInvoiceRepository
    ) {}

    async exec(input: ListAdminSchoolInvoicesInput): Promise<ListAdminSchoolInvoicesOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw new Error('School id is required');
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw new Error('School not found');
        }

        const list = this.invoices.findBySchoolId
            ? await this.invoices.findBySchoolId(schoolId)
            : [];

        return {
            schoolId,
            invoices: list.map((inv) => presentSchoolPlanInvoice(inv))
        };
    }
}
