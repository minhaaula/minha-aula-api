import { Money } from '../../domain/value-objects/money';
import { PaymentMethod } from '../../domain/entities/payment';
import { CreateBoletoChargeInput } from './payment-provider.port';

export type AsaasChargeResponse = {
    providerRef: string;
    barcode?: string;
    boletoUrl?: string;
    digitableLine?: string;
    dueDate: Date;
};

export type CreateAsaasSubAccountInput = {
    name: string;
    email: string;
    cpfCnpj: string;
    birthDate?: string | null;
    phone?: string | null;
    mobilePhone?: string | null;
    companyType?: string | null;
    incomeValue: number;
    externalReference?: string | null;
    observations?: string | null;
    additionalEmails?: string | null;
    address?: string | null;
    addressNumber?: string | null;
    complement?: string | null;
    province?: string | null;
    postalCode?: string | null;
    municipalInscription?: string | null;
    stateInscription?: string | null;
    webhooks?: Array<{
        name: string;
        url: string;
        email?: string | null;
        sendType?: 'SIMULTANEOUSLY' | 'SEQUENTIALLY';
        interrupted?: boolean;
        enabled?: boolean;
        apiVersion?: number;
        authToken?: string | null;
        events?: string[];
    }>;
};

export type AsaasSubAccount = {
    id: string;
    name: string;
    email: string;
    status?: string;
    externalReference?: string | null;
    apiKey?: string;
    walletId?: string;
};

export type AsaasAccountDetails = {
    id: string;
    name: string;
    email: string;
    status?: string;
    externalReference?: string | null;
    apiKey?: string;
    walletId?: string;
    onboardingUrl?: string;
    kycUrl?: string;
};

export type CreateAsaasTransferInput = {
    accountId: string;
    amount: Money;
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

export type AsaasTransferResponse = {
    id: string;
    status: string;
    value: number;
    netValue?: number;
    transferFee?: number;
    effectiveDate?: Date;
    scheduleDate?: Date;
    dateCreated: Date;
    bankAccount?: string;
    transactionReceiptUrl?: string;
};

export interface AsaasProviderPort {
    createBoletoCharge(input: CreateBoletoChargeInput): Promise<AsaasChargeResponse>;
    authorizeCharge(input: { amount: Money; method: PaymentMethod; customerId: string; metadata?: Record<string, string>; }): Promise<{ providerRef: string }>;
    captureCharge(providerRef: string, amount?: Money): Promise<void>;
    createSubAccount?(input: CreateAsaasSubAccountInput): Promise<AsaasSubAccount>;
    createTransfer?(input: CreateAsaasTransferInput): Promise<AsaasTransferResponse>;
    getAccount?(accountId: string): Promise<AsaasAccountDetails>;
}
