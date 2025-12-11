export type AsaasCreateTransferPayload = {
    value: number;
    bankAccount: string;
    bankAccountDigit?: string;
    bankAgency: string;
    bankAgencyDigit?: string;
    bankCode: string;
    accountType: 'CORRENTE' | 'POUPANCA';
    documentHolder: string;
    description?: string;
    pixKey?: string;
};

export type AsaasCreateTransferResponse = {
    id: string;
    status: string;
    value: number;
    netValue?: number;
    transferFee?: number;
    effectiveDate?: string;
    scheduleDate?: string;
    dateCreated: string;
    bankAccount?: string;
    transactionReceiptUrl?: string;
};


