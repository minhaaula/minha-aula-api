import { SchoolPlanInvoice } from '../../domain/entities/school-plan-invoice';

export type PaymentHistoryFilters = {
    schoolName?: string | null;
    status?: string | null;
    month?: number | null;
    year?: number | null;
};

export type PaymentHistoryItem = {
    id: string;
    schoolId: string;
    schoolName: string;
    planId: string;
    financeId: string;
    status: string;
    amountCents: number;
    currency: string;
    dueDate: Date;
    paidAt: Date | null;
    description: string | null;
    createdAt: Date;
};

export type PaymentHistoryResult = {
    items: PaymentHistoryItem[];
    total: number;
    limit: number;
    offset: number;
};

export interface SchoolPlanInvoiceRepository {
    findById(id: string): Promise<SchoolPlanInvoice | null>;
    /** Retorna true se a escola tiver ao menos uma invoice com status PAID (primeiro pagamento já realizado). */
    hasSchoolAnyPaidInvoice(schoolId: string): Promise<boolean>;
    /** Retorna o conjunto de schoolIds (do array informado) que possuem ao menos uma invoice PAID. */
    getSchoolIdsWithPaidInvoice(schoolIds: string[]): Promise<Set<string>>;
    findByFinanceIdAndDueDate(financeId: string, dueDate: Date): Promise<SchoolPlanInvoice | null>;
    findByProviderRef(providerRef: string): Promise<SchoolPlanInvoice | null>;
    findByExternalReference(externalReference: string): Promise<SchoolPlanInvoice | null>;
    findByFinanceId(financeId: string): Promise<SchoolPlanInvoice[]>;
    findBySchoolId?(schoolId: string): Promise<SchoolPlanInvoice[]>;
    findPaidWithoutReceiptUrl(limit: number): Promise<SchoolPlanInvoice[]>;
    findIssuedWithProviderRef(limit: number, daysAgo?: number): Promise<SchoolPlanInvoice[]>;
    /** Faturas emitidas com vencimento entre start e end (inclusive), com boleto disponível. */
    findIssuedByDueDateRange(startDate: Date, endDate: Date): Promise<SchoolPlanInvoice[]>;
    save(invoice: SchoolPlanInvoice): Promise<void>;
    findPaymentHistoryPaginated?(
        filters: PaymentHistoryFilters,
        limit: number,
        offset: number
    ): Promise<PaymentHistoryResult>;
}
