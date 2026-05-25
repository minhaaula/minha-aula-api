import { coerceToDate } from '../../../shared/date-utils';
import { resolveNextTuitionDueDate, startOfLocalDay } from './resolve-next-tuition-due-date';

/**
 * Data mínima de vencimento para novas mensalidades (primeira mensalidade do pedido aprovado,
 * primeira cobrança TUITION existente, ou primeiro ciclo desde a matrícula).
 */
export function resolveFirstTuitionPaymentDueDate(params: {
    enrolledAt: Date | string | number;
    paymentDueDay: number;
    requestFirstMonthlyPaymentDate?: Date | string | number | null;
    earliestTuitionChargeDueDate?: Date | string | number | null;
}): Date {
    const candidateTimes: number[] = [];

    const requestFirst = coerceToDate(params.requestFirstMonthlyPaymentDate);
    if (requestFirst) {
        candidateTimes.push(startOfLocalDay(requestFirst).getTime());
    }
    const earliestCharge = coerceToDate(params.earliestTuitionChargeDueDate);
    if (earliestCharge) {
        candidateTimes.push(startOfLocalDay(earliestCharge).getTime());
    }

    if (candidateTimes.length > 0) {
        return new Date(Math.min(...candidateTimes));
    }

    const enrolledAt = coerceToDate(params.enrolledAt) ?? new Date();
    return resolveNextTuitionDueDate(enrolledAt, params.paymentDueDay).dueDate;
}

export function isTuitionDueOnOrAfterFirstPayment(
    proposedDueDate: Date | string | number,
    firstPaymentDueDate: Date | string | number
): boolean {
    return (
        startOfLocalDay(proposedDueDate).getTime() >= startOfLocalDay(firstPaymentDueDate).getTime()
    );
}
