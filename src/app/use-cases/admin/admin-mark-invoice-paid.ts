import type { SchoolPlanInvoiceRepository } from '../../../ports/repositories/school-plan-invoice.repo';
import { AppError, ErrorCode } from '../../../shared/errors';
import { validateInvoiceStatusTransition, getInvoiceTransitionError } from '../../../domain/entities/state-transitions';

export interface AdminMarkInvoicePaidInput {
    invoiceId: string;
    /** Data do pagamento; se não informada, usa a data/hora atual. */
    paidAt?: Date;
}

export interface AdminMarkInvoicePaidOutput {
    invoiceId: string;
    status: string;
    paidAt: Date;
}

export class AdminMarkInvoicePaid {
    constructor(private readonly invoiceRepo: SchoolPlanInvoiceRepository) {}

    async exec(input: AdminMarkInvoicePaidInput): Promise<AdminMarkInvoicePaidOutput> {
        const invoiceId = input.invoiceId?.trim();
        if (!invoiceId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'invoiceId' });
        }

        const invoice = await this.invoiceRepo.findById(invoiceId);
        if (!invoice) {
            throw AppError.notFound('Fatura', { invoiceId });
        }

        if (invoice.status === 'PAID') {
            return {
                invoiceId: invoice.id,
                status: 'PAID',
                paidAt: invoice.paidAt!
            };
        }

        if (!validateInvoiceStatusTransition(invoice.status, 'PAID')) {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                reason: getInvoiceTransitionError(invoice.status, 'PAID')
            });
        }

        const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
        if (Number.isNaN(paidAt.getTime())) {
            throw AppError.fromCode(ErrorCode.INVALID_DATE, { field: 'paidAt' });
        }

        const updated = invoice.withChanges({
            status: 'PAID',
            paidAt,
            updatedAt: new Date()
        });
        await this.invoiceRepo.save(updated);

        return {
            invoiceId: updated.id,
            status: updated.status,
            paidAt: updated.paidAt!
        };
    }
}
