import { Payment } from "../../domain/entities/payment";
import { Money } from "../../domain/value-objects/money";
import { PaymentProviderPort } from "../../ports/providers/payment-provider.port";
import { OutboxRepository } from "../../ports/repositories/outbox.repo";
import { PaymentRepository } from "../../ports/repositories/payment.repo";
import { Uuid } from "../../shared/uuid";
import type { CreatePaymentInput, CreatePaymentOutput } from '../types/payment.types';

export class CreatePayment {
    constructor(
        private readonly payments: PaymentRepository,
        private readonly provider: PaymentProviderPort,
        private readonly outbox: OutboxRepository
    ) {}

    async exec(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
        const existing = await this.payments.findByIdempotencyKey(input.idempotencyKey);
        if (existing) return { paymentId: existing.id, status: existing.status };

        const payment = Payment.create({ id: Uuid(), amount: Money.of(input.amount, input.currency), method: input.method, customerId: input.customerId, metadata: input.metadata });

        const { providerRef } = await this.provider.authorize({ amount: payment.amount, method: payment.method, customerId: payment.customerId, metadata: payment.metadata });
        payment.authorize(providerRef);

        await this.payments.save(payment, { expectedVersion: 0 });
        await this.payments.linkIdempotencyKey(payment.id, input.idempotencyKey);

        await this.outbox.enqueue({ type: 'PaymentAuthorized', aggregateId: payment.id, payload: { paymentId: payment.id, providerRef } });

        return { paymentId: payment.id, status: payment.status };
    }
}
