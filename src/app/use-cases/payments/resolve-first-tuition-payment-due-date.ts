import { resolveNextTuitionDueDate, startOfLocalDay } from './resolve-next-tuition-due-date';

/**
 * Data mínima de vencimento para novas mensalidades (primeira mensalidade do pedido aprovado,
 * primeira cobrança TUITION existente, ou primeiro ciclo desde a matrícula).
 */
export function resolveFirstTuitionPaymentDueDate(params: {
    enrolledAt: Date;
    paymentDueDay: number;
    requestFirstMonthlyPaymentDate?: Date | null;
    earliestTuitionChargeDueDate?: Date | null;
}): Date {
    const candidateTimes: number[] = [];

    if (params.requestFirstMonthlyPaymentDate) {
        candidateTimes.push(startOfLocalDay(params.requestFirstMonthlyPaymentDate).getTime());
    }
    if (params.earliestTuitionChargeDueDate) {
        candidateTimes.push(startOfLocalDay(params.earliestTuitionChargeDueDate).getTime());
    }

    if (candidateTimes.length > 0) {
        return new Date(Math.min(...candidateTimes));
    }

    return resolveNextTuitionDueDate(params.enrolledAt, params.paymentDueDay).dueDate;
}

export function isTuitionDueOnOrAfterFirstPayment(proposedDueDate: Date, firstPaymentDueDate: Date): boolean {
    return (
        startOfLocalDay(proposedDueDate).getTime() >= startOfLocalDay(firstPaymentDueDate).getTime()
    );
}
