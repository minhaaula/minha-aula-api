import { Money } from "src/domain/value-objects/money";
import { PaymentProviderPort } from "src/ports/providers/payment-provider.port";
import { OutboxRepository } from "src/ports/repositories/outbox.repo";
import { PaymentRepository } from "src/ports/repositories/payment.repo";

export class CapturePayment {
    constructor(
        private readonly payments: PaymentRepository,
        private readonly provider: PaymentProviderPort,
        private readonly outbox: OutboxRepository
    ) {}


    async exec(paymentId: string, partialAmount?: number) {
        const payment = await this.payments.findById(paymentId);
        if (!payment) throw new Error('Payment not found');
        const expected = payment.version;

        await this.provider.capture(payment.providerRef!, partialAmount ? Money.of(partialAmount, payment.amount.currency) : undefined);

        payment.capture();
        await this.payments.save(payment, { expectedVersion: expected });

        await this.outbox.enqueue({ type: 'PaymentCaptured', aggregateId: payment.id, payload: { paymentId: payment.id, amount: partialAmount ?? payment.amount.amount } });

        return { paymentId: payment.id, status: payment.status };
    }
}
