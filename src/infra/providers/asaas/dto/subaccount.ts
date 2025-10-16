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
};
