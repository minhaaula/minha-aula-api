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

export interface AsaasProviderPort {
    createBoletoCharge(input: CreateBoletoChargeInput): Promise<AsaasChargeResponse>;
    authorizeCharge(input: { amount: Money; method: PaymentMethod; customerId: string; metadata?: Record<string, string>; }): Promise<{ providerRef: string }>;
    captureCharge(providerRef: string, amount?: Money): Promise<void>;
}
