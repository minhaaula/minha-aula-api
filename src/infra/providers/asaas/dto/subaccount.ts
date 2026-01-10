export type AsaasCreateSubAccountPayload = {
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
    notificationDisabled?: boolean;
    webhooks?: AsaasCreateSubAccountWebhookPayload[];
};

export type AsaasSubAccountResponse = {
    id: string;
    name: string;
    email: string;
    cpfCnpj?: string;
    personType?: string;
    companyType?: string;
    status?: string;
    externalReference?: string;
    apiKey?: string
    walletId?: string
    onboardingUrl?: string;
    kycUrl?: string;
};

export type AsaasCreateSubAccountWebhookPayload = {
    name: string;
    url: string;
    email?: string | null;
    sendType?: 'SIMULTANEOUSLY' | 'SEQUENTIALLY';
    interrupted?: boolean;
    enabled?: boolean;
    apiVersion?: number;
    authToken?: string | null;
    events?: string[];
};
