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
};

export type AsaasSubAccount = {
    id: string;
    name: string;
    email: string;
    status?: string;
    externalReference?: string | null;
};

export interface AsaasProviderPort {
    createBoletoCharge(input: CreateBoletoChargeInput): Promise<AsaasChargeResponse>;
    authorizeCharge(input: { amount: Money; method: PaymentMethod; customerId: string; metadata?: Record<string, string>; }): Promise<{ providerRef: string }>;
    captureCharge(providerRef: string, amount?: Money): Promise<void>;
    createSubAccount?(input: CreateAsaasSubAccountInput): Promise<AsaasSubAccount>;
}
