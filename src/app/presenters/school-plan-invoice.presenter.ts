import { SchoolPlanInvoice } from '../../domain/entities/school-plan-invoice';

export type SchoolPlanInvoiceView = {
    id: string;
    financeId: string;
    schoolId: string;
    planId: string;
    status: 'ISSUED' | 'PAID' | 'FAILED' | 'CANCELLED';
    amountCents: number;
    currency: string;
    dueDate: Date;
    description: string | null;
    providerRef: string | null;
    boletoUrl: string | null;
    digitableLine: string | null;
    barcode: string | null;
    externalReference: string | null;
    metadata: Record<string, string>;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export function presentSchoolPlanInvoice(invoice: SchoolPlanInvoice): SchoolPlanInvoiceView {
    return {
        id: invoice.id,
        financeId: invoice.financeId,
        schoolId: invoice.schoolId,
        planId: invoice.planId,
        status: invoice.status,
        amountCents: invoice.amountCents,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        description: invoice.description,
        providerRef: invoice.providerRef,
        boletoUrl: invoice.boletoUrl,
        digitableLine: invoice.digitableLine,
        barcode: invoice.barcode,
        externalReference: invoice.externalReference,
        metadata: { ...invoice.metadata },
        paidAt: invoice.paidAt,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt
    };
}
