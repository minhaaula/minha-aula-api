import type { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import type { PaymentHistoryFilters, PaymentHistoryResult } from '../../ports/repositories/school-plan-invoice.repo';

export type ListAdminPaymentHistoryInput = {
    schoolName?: string | null;
    status?: string | null;
    month?: number | null;
    year?: number | null;
    limit?: number;
    offset?: number;
};

export class ListAdminPaymentHistory {
    constructor(private readonly invoices: SchoolPlanInvoiceRepository) {}

    async exec(input: ListAdminPaymentHistoryInput): Promise<PaymentHistoryResult> {
        const findPaginated = this.invoices.findPaymentHistoryPaginated;
        if (!findPaginated) {
            const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
            const offset = Math.max(0, input.offset ?? 0);
            return {
                items: [],
                total: 0,
                limit,
                offset
            };
        }

        const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
        const offset = Math.max(0, input.offset ?? 0);

        return findPaginated(
            {
                schoolName: input.schoolName ?? null,
                status: input.status ?? null,
                month: input.month ?? null,
                year: input.year ?? null
            },
            limit,
            offset
        );
    }
}
