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

export type AsaasAccountBalance = {
    balance: number;
    availableBalance: number;
    blockedBalance?: number;
};

export type AsaasPaymentDetails = {
    id: string;
    status?: string;
    transactionReceiptUrl?: string | null;
    paymentDate?: string | null;
    confirmedDate?: string | null;
    receivedDate?: string | null;
};

export type AsaasPixQrCodeResponse = {
    encodedImage: string;
    payload: string;
};

export type AsaasPaymentListItem = {
    id: string;
    status?: string;
    externalReference?: string | null;
    paymentDate?: string | null;
    confirmedDate?: string | null;
    receivedDate?: string | null;
    dueDate?: string | null;
    value?: number | null;
    transactionReceiptUrl?: string | null;
};

export type ListAsaasPaymentsParams = {
    status?: string;
    externalReference?: string;
    limit?: number;
    offset?: number;
};

export type ListAsaasPaymentsResponse = {
    data: AsaasPaymentListItem[];
    totalCount?: number;
};

export interface AsaasProviderPort {
    createBoletoCharge(input: CreateBoletoChargeInput): Promise<AsaasChargeResponse>;
    authorizeCharge(input: { amount: Money; method: PaymentMethod; customerId: string; metadata?: Record<string, string>; }): Promise<{ providerRef: string }>;
    captureCharge(providerRef: string, amount?: Money): Promise<void>;
    createSubAccount?(input: CreateAsaasSubAccountInput): Promise<AsaasSubAccount>;
    /** Lista subcontas por e-mail (útil quando a API retorna "email já está em uso"). */
    listAccountsByEmail?(email: string): Promise<AsaasSubAccount[]>;
    createTransfer?(input: CreateAsaasTransferInput): Promise<AsaasTransferResponse>;
    getAccount?(accountId: string): Promise<AsaasAccountDetails>;
    getAccountBalance?(accountId: string): Promise<AsaasAccountBalance>;
    /** Saldo disponível da conta principal (nossa empresa). GET /finance/balance. */
    getMainAccountBalance?(): Promise<{ balance: number }>;
    getPayment?(paymentId: string): Promise<AsaasPaymentDetails>;
    /** Obtém QR Code do PIX de um pagamento (GET /payments/{id}/pixQrCode). */
    getPixQrCode?(paymentId: string): Promise<AsaasPixQrCodeResponse>;
    listPayments?(params?: ListAsaasPaymentsParams): Promise<ListAsaasPaymentsResponse>;
    /**
     * Exclui uma cobrança no Asaas (DELETE /v3/payments/{id}).
     * Usar quando der baixa manual em cobrança que tem PIX/boleto para não deixar link ativo.
     */
    deletePayment?(paymentId: string): Promise<{ deleted: boolean; id: string }>;
    /**
     * Marca a cobrança como recebida em dinheiro no Asaas (POST /v3/payments/{id}/receiveInCash).
     * Usado quando a escola/admin dá baixa manual: o PIX/boleto fica marcado como pago no Asaas.
     */
    receivePaymentInCash?(paymentId: string, payload: { paymentDate: string; value: number; notifyCustomer?: boolean }): Promise<void>;
    /** Obtém a URL de onboarding (documentos) usando a API key da subconta. Recomenda-se aguardar ~15s após criar a subconta. */
    getOnboardingUrl?(accountApiKey: string): Promise<string | null>;
    /**
     * Lista documentos pendentes da subconta (GET /v3/myAccount/documents).
     * Conforme documentação Asaas: aguardar 15s após criar a subconta antes de chamar.
     * Retorna grupos com onboardingUrl para redirecionar o cliente ao envio via link.
     */
    getPendingDocuments?(accountApiKey: string): Promise<AsaasPendingDocumentsResult>;
    /**
     * Envia um documento para um grupo pendente (POST /v3/myAccount/documents/{id}).
     * Usar quando não houver onboardingUrl (envio manual). Campo multipart: documentFile + type.
     * O type deve ser o do grupo (ex.: IDENTIFICATION, IDENTIFICATION_SELFIE, MINUTES_OF_ELECTION).
     */
    uploadDocument?(accountApiKey: string, documentGroupId: string, fileBuffer: Buffer, mimeType: string, type: string): Promise<void>;
    /**
     * Obtém o status cadastral da subconta (GET /v3/myAccount/status).
     * Deve ser chamado com a API key da subconta. Retorna commercialInfo, bankAccountInfo, documentation, general.
     */
    getAccountStatus?(accountApiKey: string): Promise<AsaasAccountStatus | null>;
}

/** Grupo de documentos pendentes (AccountDocumentGroupResponseDTO). */
export interface AsaasPendingDocumentGroup {
    id: string;
    status: string;
    type: string;
    title: string;
    description: string;
    onboardingUrl: string | null;
    onboardingUrlExpirationDate: string | null;
    responsible?: { name: string | null; type: string } | null;
    documents?: Array<{ id: string; status: string }>;
}

export interface AsaasPendingDocumentsResult {
    rejectReasons: string | null;
    data: AsaasPendingDocumentGroup[];
}

/** Status cadastral da subconta (GET /v3/myAccount/status). */
export type AsaasAccountStatus = {
    id: string;
    commercialInfo: string;
    bankAccountInfo: string;
    documentation: string;
    general: string;
};
