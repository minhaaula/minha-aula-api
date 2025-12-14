export type AsaasPixCustomerPayload = {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    addressComplement?: string | null;
    phone?: string | null;
};

export type AsaasCreatePixPayload = {
    customer: AsaasPixCustomerPayload;
    value: number;
    dueDate: string;
    description?: string | null;
    externalReference?: string | null;
    billingType: 'PIX';
    metadata?: Record<string, string>;
};

export type AsaasCreatePixResponse = {
    id: string;
    dueDate: string;
    billingType: string;
    value: number;
    invoiceUrl?: string;
    status?: string;
    description?: string;
    customer?: string;
    externalReference?: string;
    pixQrCode?: string;
    pixCopiaECola?: string;
};

