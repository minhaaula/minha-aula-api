import { describe, expect, it } from 'vitest';
import {
    isTuitionDueOnOrAfterFirstPayment,
    resolveFirstTuitionPaymentDueDate
} from '../../src/app/use-cases/payments/resolve-first-tuition-payment-due-date';

describe('resolveFirstTuitionPaymentDueDate', () => {
    it('usa firstMonthlyPaymentDate do pedido aprovado como piso', () => {
        const first = resolveFirstTuitionPaymentDueDate({
            enrolledAt: new Date(2026, 4, 10),
            paymentDueDay: 25,
            requestFirstMonthlyPaymentDate: new Date(2026, 4, 25)
        });
        expect(first.getFullYear()).toBe(2026);
        expect(first.getMonth()).toBe(4);
        expect(first.getDate()).toBe(25);
    });

    it('primeira cobrança existente também define o piso', () => {
        const first = resolveFirstTuitionPaymentDueDate({
            enrolledAt: new Date(2026, 4, 1),
            paymentDueDay: 10,
            earliestTuitionChargeDueDate: new Date(2026, 4, 20)
        });
        expect(first.getDate()).toBe(20);
    });

    it('aceita enrolledAt como string (driver MySQL / TypeORM)', () => {
        const first = resolveFirstTuitionPaymentDueDate({
            enrolledAt: '2026-05-10T15:00:00.000Z' as unknown as Date,
            paymentDueDay: 25
        });
        expect(first.getFullYear()).toBe(2026);
        expect(first.getMonth()).toBe(4);
        expect(first.getDate()).toBe(25);
    });

    it('não permite vencimento antes da primeira mensalidade', () => {
        const firstPayment = new Date(2026, 4, 25);
        const proposed = new Date(2026, 4, 22);
        expect(isTuitionDueOnOrAfterFirstPayment(proposed, firstPayment)).toBe(false);
        expect(isTuitionDueOnOrAfterFirstPayment(firstPayment, firstPayment)).toBe(true);
        expect(isTuitionDueOnOrAfterFirstPayment(new Date(2026, 5, 25), firstPayment)).toBe(true);
    });
});
