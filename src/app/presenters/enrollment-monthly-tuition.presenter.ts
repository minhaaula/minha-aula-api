import type { TuitionExemptionType } from '../../domain/value-objects/tuition-exemption-type';
import { parseTuitionExemptionType } from '../../domain/value-objects/tuition-exemption-type';
import { presentTuitionExemption, type TuitionExemptionApiFields } from './tuition-exemption.presenter';

export type EnrollmentMonthlyTuitionApiFields = TuitionExemptionApiFields & {
    paymentDueDay: number | null;
    /** Valor efetivo da matrícula (null quando isento). */
    fullAmountCents: number | null;
    discountCents: number | null;
    discountMonths: number | null;
    /**
     * Valor de referência da turma/curso (cents), mesmo quando isento.
     * Prioridade: matrícula → turma → curso.
     */
    referenceFullAmountCents: number | null;
    /** Valor bruto cobrado em reais; quando isento, espelha o valor de referência da turma para exibição. */
    monthlyTuitionAmount: number | null;
    /** Valor de referência da turma em reais (sempre que houver preço no catálogo). */
    referenceMonthlyTuitionAmount: number | null;
    /** Desconto em reais. */
    discount: number | null;
    /** Valor líquido da mensalidade em reais (null quando isento). */
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

function resolveReferenceFullAmountCents(params: {
    enrollmentFullAmountCents: number | null | undefined;
    classMonthlyPriceCents: number | null | undefined;
    courseMonthlyPriceCents: number | null | undefined;
}): number | null {
    if (params.enrollmentFullAmountCents != null && params.enrollmentFullAmountCents > 0) {
        return params.enrollmentFullAmountCents;
    }
    if (params.classMonthlyPriceCents != null && params.classMonthlyPriceCents > 0) {
        return params.classMonthlyPriceCents;
    }
    if (params.courseMonthlyPriceCents != null && params.courseMonthlyPriceCents > 0) {
        return params.courseMonthlyPriceCents;
    }
    return null;
}

export function presentEnrollmentMonthlyTuition(params: {
    tuitionExemptionType: TuitionExemptionType | null | undefined;
    fullAmountCents: number | null | undefined;
    paymentDueDay: number | null | undefined;
    discountCents: number | null | undefined;
    discountMonths: number | null | undefined;
    courseMonthlyPriceCents?: number | null;
    classMonthlyPriceCents?: number | null;
}): EnrollmentMonthlyTuitionApiFields {
    const exemption = presentTuitionExemption(params.tuitionExemptionType);
    const referenceFullAmountCents = resolveReferenceFullAmountCents({
        enrollmentFullAmountCents: params.fullAmountCents,
        classMonthlyPriceCents: params.classMonthlyPriceCents,
        courseMonthlyPriceCents: params.courseMonthlyPriceCents
    });

    const fullAmountCents = exemption.tuitionExempt ? null : (params.fullAmountCents ?? null);
    const discountCents = exemption.tuitionExempt ? null : (params.discountCents ?? null);
    const discountMonths = exemption.tuitionExempt ? null : (params.discountMonths ?? null);
    const netCents = computeNetCents(fullAmountCents, discountCents);

    const referenceMonthlyTuitionAmount = centsToReais(referenceFullAmountCents);
    const monthlyTuitionAmount = exemption.tuitionExempt
        ? referenceMonthlyTuitionAmount
        : centsToReais(fullAmountCents);

    return {
        ...exemption,
        paymentDueDay: params.paymentDueDay ?? null,
        fullAmountCents,
        discountCents,
        discountMonths,
        referenceFullAmountCents,
        monthlyTuitionAmount,
        referenceMonthlyTuitionAmount,
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
    course_monthly_price_cents?: number | null;
    class_monthly_price_cents?: number | null;
}): EnrollmentMonthlyTuitionApiFields {
    return presentEnrollmentMonthlyTuition({
        tuitionExemptionType: parseTuitionExemptionType(row.enrollment_tuition_exemption_type ?? null),
        fullAmountCents: row.enrollment_full_amount_cents ?? null,
        paymentDueDay: row.enrollment_payment_due_day ?? null,
        discountCents: row.enrollment_discount_cents ?? null,
        discountMonths: row.enrollment_discount_months ?? null,
        courseMonthlyPriceCents: row.course_monthly_price_cents ?? null,
        classMonthlyPriceCents: row.class_monthly_price_cents ?? null
    });
}
