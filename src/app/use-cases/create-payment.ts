import { Payment } from "src/domain/entities/payment";
import { Money } from "src/domain/value-objects/money";
import { PaymentProviderPort } from "src/ports/providers/payment-provider.port";
import { OutboxRepository } from "src/ports/repositories/outbox.repo";
import { PaymentRepository } from "src/ports/repositories/payment.repo";
import { Uuid } from "src/shared/uuid";

export class CreatePayment {
    constructor(
        private readonly payments: PaymentRepository,
        private readonly provider: PaymentProviderPort,
        private readonly outbox: OutboxRepository
    ) {}

    async exec(input: { idempotencyKey: string; amount: number; currency: string; method: 'CARD'|'PIX'|'BOLETO'; customerId: string; metadata?: Record<string,string>; }) {
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