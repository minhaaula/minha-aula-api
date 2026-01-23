import { SchoolPlanInvoice } from '../../domain/entities/school-plan-invoice';

export interface SchoolPlanInvoiceRepository {
    findByFinanceIdAndDueDate(financeId: string, dueDate: Date): Promise<SchoolPlanInvoice | null>;
    findByProviderRef(providerRef: string): Promise<SchoolPlanInvoice | null>;
    findByExternalReference(externalReference: string): Promise<SchoolPlanInvoice | null>;
    findByFinanceId(financeId: string): Promise<SchoolPlanInvoice[]>;
    findPaidWithoutReceiptUrl(limit: number): Promise<SchoolPlanInvoice[]>;
    findIssuedWithProviderRef(limit: number, daysAgo?: number): Promise<SchoolPlanInvoice[]>;
    save(invoice: SchoolPlanInvoice): Promise<void>;
}
