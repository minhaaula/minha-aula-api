import { describe, expect, it } from 'vitest';
import {
    presentEnrollmentMonthlyTuition,
    presentEnrollmentMonthlyTuitionFromEnrollmentRaw
} from '../../src/app/presenters/enrollment-monthly-tuition.presenter';

describe('enrollment-monthly-tuition presenter', () => {
    it('apresenta mensalidade pagante com desconto', () => {
        const result = presentEnrollmentMonthlyTuition({
            tuitionExemptionType: null,
            fullAmountCents: 25000,
            paymentDueDay: 10,
            discountCents: 5000,
            discountMonths: 3
        });

        expect(result.tuitionExempt).toBe(false);
        expect(result.fullAmountCents).toBe(25000);
        expect(result.monthlyTuitionAmount).toBe(250);
        expect(result.discount).toBe(50);
        expect(result.monthlyTuitionNetAmount).toBe(200);
        expect(result.discountMonths).toBe(3);
        expect(result.paymentDueDay).toBe(10);
    });

    it('apresenta isenção sem valores de mensalidade', () => {
        const result = presentEnrollmentMonthlyTuition({
            tuitionExemptionType: 'SCHOLARSHIP',
            fullAmountCents: 25000,
            paymentDueDay: 10,
            discountCents: 5000,
            discountMonths: 3
        });

        expect(result.tuitionExempt).toBe(true);
        expect(result.tuitionExemptionType).toBe('SCHOLARSHIP');
        expect(result.fullAmountCents).toBeNull();
        expect(result.monthlyTuitionAmount).toBeNull();
        expect(result.monthlyTuitionNetAmount).toBeNull();
    });

    it('mapeia aliases do TypeORM getRawMany', () => {
        const result = presentEnrollmentMonthlyTuitionFromEnrollmentRaw({
            enrollment_tuition_exemption_type: null,
            enrollment_full_amount_cents: 15000,
            enrollment_payment_due_day: 5,
            enrollment_discount_cents: null,
            enrollment_discount_months: null
        });

        expect(result.monthlyTuitionAmount).toBe(150);
        expect(result.paymentDueDay).toBe(5);
    });
});
