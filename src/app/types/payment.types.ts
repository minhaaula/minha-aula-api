/**
 * Tipos relacionados a pagamentos
 */

export interface CreatePaymentInput {
    idempotencyKey: string;
    amount: number;
    currency: string;
    method: 'CARD' | 'PIX' | 'BOLETO';
    customerId: string;
    metadata?: Record<string, string>;
}

export interface CreatePaymentOutput {
    paymentId: string;
    status: string;
}

export interface CapturePaymentInput {
    paymentId: string;
}

export interface CapturePaymentOutput {
    paymentId: string;
    status: string;
}

export interface IssueBoletoInput {
    chargeId: string;
    amountCents: number;
    dueDate: Date;
    customerId: string;
    description?: string | null;
}

export interface IssueBoletoOutput {
    providerRef: string;
    boletoUrl?: string;
    digitableLine?: string;
    barcode?: string;
    dueDate: Date;
}

export interface ListSchoolPaymentsInput {
    schoolId: string;
    month: number;
    year: number;
    studentName?: string | null;
    classId?: string | null;
    status?: string | null;
}

export interface SchoolPaymentRecord {
    id: string;
    amountCents: number;
    discountCents: number | null;
    discountReason: string | null;
    netAmountCents: number;
    status: string;
    chargeType: string;
    description: string | null;
    dueDate: Date;
    asaasPaymentId: string | null;
    asaasInvoiceUrl: string | null;
    paidAt: Date | null;
    type: 'PIX' | 'BOLETO' | 'MANUAL' | null;
    createdAt: Date;
    updatedAt: Date;
    student: {
        id: string;
        fullName: string;
        type: 'USER' | 'DEPENDENT';
    };
    dependent: {
        id: string;
        fullName: string;
    } | null;
    course: {
        id: string;
        name: string;
    };
    class: {
        id: string;
        label: string;
    } | null;
}

export interface ListPaidSchoolPaymentsInput {
    schoolId: string;
    studentName?: string | null;
    limit?: number;
    offset?: number;
}

export interface ListPaidSchoolPaymentsOutput {
    payments: SchoolPaymentRecord[];
    total: number;
    limit: number;
    offset: number;
}

export interface HandleAsaasPaymentWebhookInput {
    event: string;
    payment?: {
        id?: string | null;
        status?: string | null;
        externalReference?: string | null;
        paymentDate?: string | null;
        confirmedDate?: string | null;
        receivedDate?: string | null;
        dueDate?: string | null;
        customer?: { id?: string | null } | null;
        value?: number | null;
    } | null;
}

