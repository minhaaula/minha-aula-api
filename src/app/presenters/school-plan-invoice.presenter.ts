import { SchoolPlanInvoice } from '../../domain/entities/school-plan-invoice';

export type SchoolPlanInvoiceView = {
    id: string;
    financeId: string;
    schoolId: string;
    planId: string;
    status: 'ISSUED' | 'PAID' | 'FAILED' | 'CANCELLED';
    paymentStatus: 'pendente' | 'pago' | 'atrasado';
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

function calculatePaymentStatus(invoice: SchoolPlanInvoice): 'pendente' | 'pago' | 'atrasado' {
    if (invoice.status === 'PAID') {
        return 'pago';
    }

    if (invoice.status === 'CANCELLED') {
        return 'pendente';
    }

    // Para status ISSUED ou FAILED, verificar se está atrasado
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    // Comparar apenas a data (sem hora) para determinar se está atrasado
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    if (today > due) {
        return 'atrasado';
    }

    return 'pendente';
}

export function presentSchoolPlanInvoice(invoice: SchoolPlanInvoice): SchoolPlanInvoiceView {
    return {
        id: invoice.id,
        financeId: invoice.financeId,
        schoolId: invoice.schoolId,
        planId: invoice.planId,
        status: invoice.status,
        paymentStatus: calculatePaymentStatus(invoice),
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
