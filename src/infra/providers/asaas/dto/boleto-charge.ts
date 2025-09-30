export type AsaasBoletoCustomerPayload = {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    addressComplement?: string | null;
    phone?: string | null;
};

export type AsaasCreateBoletoPayload = {
    customer: AsaasBoletoCustomerPayload;
    value: number;
    dueDate: string;
    description?: string | null;
    externalReference?: string | null;
    billingType: 'BOLETO';
    metadata?: Record<string, string>;
};

export type AsaasCreateChargeResponse = {
    id: string;
    dueDate: string;
    billingType: string;
    value: number;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    boletoUrl?: string;
    bankSlipNumber?: string;
    discountedAmount?: number;
    description?: string;
    customer?: string;
    status?: string;
    valueWithDiscount?: number;
    interestValue?: number;
    originalValue?: number;
    installmentValue?: number;
    paymentLink?: string;
    externalReference?: string;
    nossoNumero?: string;
    invoiceNumber?: string;
    bankSlipBarcode?: string;
    bankSlipDigitableLine?: string;
};
