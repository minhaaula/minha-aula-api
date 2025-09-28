import { describe, expect, it } from 'vitest';
import { Payment } from './payment';
import { Money } from '../value-objects/money';

describe('Payment entity', () => {
    it('creates a payment with initial state', () => {
        const payment = Payment.create({
            id: 'payment-1',
            amount: Money.of(1000, 'BRL'),
            method: 'CARD',
            customerId: 'customer-1',
            metadata: { orderId: 'order-1' }
        });

        expect(payment.status).toBe('CREATED');
        expect(payment.providerRef).toBeNull();
        expect(payment.version).toBe(0);
        expect(payment.enrollmentId).toBeNull();
    });

    it('authorizes and captures payment updating version', () => {
        const payment = Payment.create({
            id: 'payment-2',
            amount: Money.of(5000, 'USD'),
            method: 'PIX',
            customerId: 'customer-2',
            enrollmentId: 'enrollment-1'
        });

        payment.authorize('provider-123');
        expect(payment.status).toBe('AUTHORIZED');
        expect(payment.providerRef).toBe('provider-123');
        expect(payment.version).toBe(1);
        expect(payment.enrollmentId).toBe('enrollment-1');

        payment.capture();
        expect(payment.status).toBe('CAPTURED');
        expect(payment.version).toBe(2);
    });

    it('prevents invalid transitions', () => {
        const payment = Payment.create({
            id: 'payment-3',
            amount: Money.of(2000, 'EUR'),
            method: 'BOLETO',
            customerId: 'customer-3'
        });

        payment.fail();
        expect(payment.status).toBe('FAILED');

        expect(() => payment.capture()).toThrowError('Invalid transition');
    });
});
