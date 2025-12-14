import { Money } from '../../domain/value-objects/money';
import { PaymentMethod } from '../../domain/entities/payment';

export interface BoletoCustomer {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    addressComplement?: string | null;
    phone?: string | null;
}

export interface CreateChargeInput {
    amount: Money;
    method: PaymentMethod;
    customerId: string;
    metadata?: Record<string,string>;
}

export interface CreateBoletoChargeInput {
    amount: Money;
    customer: BoletoCustomer;
    dueDate: Date;
    description?: string | null;
    externalReference?: string | null;
    metadata?: Record<string,string>;
}

export interface CreatePixChargeInput {
    amount: Money;
    customer: BoletoCustomer;
    dueDate: Date;
    description?: string | null;
    externalReference?: string | null;
    metadata?: Record<string,string>;
}

export interface PaymentProviderPort {
    authorize(input: CreateChargeInput): Promise<{ providerRef: string }>;
    capture(providerRef: string, amount?: Money): Promise<void>;
    createBoletoCharge?(input: CreateBoletoChargeInput): Promise<{ providerRef: string; boletoUrl?: string; digitableLine?: string; barcode?: string; dueDate: Date; }>;
    createPixCharge?(input: CreatePixChargeInput): Promise<{ providerRef: string; pixQrCode?: string; pixCopiaECola?: string; invoiceUrl?: string; dueDate: Date; }>;
}
