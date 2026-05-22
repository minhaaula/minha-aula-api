import type { TuitionExemptionType } from '../../domain/value-objects/tuition-exemption-type';
import { parseTuitionExemptionType } from '../../domain/value-objects/tuition-exemption-type';
import { presentTuitionExemption, type TuitionExemptionApiFields } from './tuition-exemption.presenter';

export type EnrollmentMonthlyTuitionApiFields = TuitionExemptionApiFields & {
    paymentDueDay: number | null;
    fullAmountCents: number | null;
    discountCents: number | null;
    discountMonths: number | null;
    /** Valor bruto da mensalidade em reais. Null quando isento. */
    monthlyTuitionAmount: number | null;
    /** Desconto em reais. */
    discount: number | null;
    /** Valor líquido da mensalidade em reais. */
    monthlyTuitionNetAmount: number | null;
};

function centsToReais(cents: number | null | undefined): number | null {
    if (cents === null || cents === undefined) return null;
    return cents / 100;
}

function computeNetCents(fullAmountCents: number | null, discountCents: number | null): number | null {
    if (fullAmountCents === null) return null;
    if (discountCents === null) return fullAmountCents;
    return Math.max(0, fullAmountCents - discountCents);
}

export function presentEnrollmentMonthlyTuition(params: {
    tuitionExemptionType: TuitionExemptionType | null | undefined;
    fullAmountCents: number | null | undefined;
    paymentDueDay: number | null | undefined;
    discountCents: number | null | undefined;
    discountMonths: number | null | undefined;
}): EnrollmentMonthlyTuitionApiFields {
    const exemption = presentTuitionExemption(params.tuitionExemptionType);
    const fullAmountCents = exemption.tuitionExempt ? null : (params.fullAmountCents ?? null);
    const discountCents = exemption.tuitionExempt ? null : (params.discountCents ?? null);
    const discountMonths = exemption.tuitionExempt ? null : (params.discountMonths ?? null);
    const netCents = computeNetCents(fullAmountCents, discountCents);

    return {
        ...exemption,
        paymentDueDay: params.paymentDueDay ?? null,
        fullAmountCents,
        discountCents,
        discountMonths,
        monthlyTuitionAmount: centsToReais(fullAmountCents),
        discount: centsToReais(discountCents),
        monthlyTuitionNetAmount: centsToReais(netCents)
    };
}

/** Mapeia aliases do TypeORM `getRawMany` em `enrollment.*`. */
export function presentEnrollmentMonthlyTuitionFromEnrollmentRaw(row: {
    enrollment_tuition_exemption_type?: string | null;
    enrollment_full_amount_cents?: number | null;
    enrollment_payment_due_day?: number | null;
    enrollment_discount_cents?: number | null;
    enrollment_discount_months?: number | null;
}): EnrollmentMonthlyTuitionApiFields {
    return presentEnrollmentMonthlyTuition({
        tuitionExemptionType: parseTuitionExemptionType(row.enrollment_tuition_exemption_type ?? null),
        fullAmountCents: row.enrollment_full_amount_cents ?? null,
        paymentDueDay: row.enrollment_payment_due_day ?? null,
        discountCents: row.enrollment_discount_cents ?? null,
        discountMonths: row.enrollment_discount_months ?? null
    });
}
