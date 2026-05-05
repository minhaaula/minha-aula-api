export type AsaasCreateTransferPayload = {
    value: number;
    description?: string;
    /** Transferência via PIX (chave) */
    pixAddressKey?: string;
    pixAddressKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
    /** Transferência para conta bancária */
    bankAccount?: {
        bank: { code: string };
        accountName?: string;
        ownerName: string;
        cpfCnpj: string;
        agency: string;
        agencyDigit?: string;
        account: string;
        accountDigit: string;
        bankAccountType: 'CONTA_CORRENTE' | 'CONTA_POUPANCA';
        ispb?: string;
    };
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


