import { Money } from '../../domain/value-objects/money';
import { PaymentMethod } from '../../domain/entities/payment';

export interface CreateChargeInput {
    amount: Money;
    method: PaymentMethod;
    customerId: string;
    metadata?: Record<string,string>;
}

export interface PaymentProviderPort {
    authorize(input: CreateChargeInput): Promise<{ providerRef: string }>;
    capture(providerRef: string, amount?: Money): Promise<void>;
}
