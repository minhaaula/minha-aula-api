import { SchoolPlanInvoice } from '../../domain/entities/school-plan-invoice';
import { isOpenChargeCalendarOverdue } from '../../shared/billing-due-date';

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
    pixQrCode: string | null;
    pixCopiaECola: string | null;
    externalReference: string | null;
    receiptUrl: string | null;
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

    // Para status ISSUED ou FAILED, verificar atraso com dia civil no fuso do app (Brasil), não só UTC/servidor
    if (isOpenChargeCalendarOverdue(new Date(invoice.dueDate))) {
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
        pixQrCode: invoice.pixQrCode,
        pixCopiaECola: invoice.pixCopiaECola,
        externalReference: invoice.externalReference,
        receiptUrl: invoice.receiptUrl,
        metadata: { ...invoice.metadata },
        paidAt: invoice.paidAt,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt
    };
}
