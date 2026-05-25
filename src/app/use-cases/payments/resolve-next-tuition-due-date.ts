import { coerceToDate } from '../../../shared/date-utils';

export type TuitionDueDateParts = {
    dueDate: Date;
    dueYear: number;
    /** 1–12 */
    dueMonth: number;
    adjustedDueDay: number;
};

export function startOfLocalDay(date: Date | string | number): Date {
    const parsed = coerceToDate(date);
    if (!parsed) {
        throw new Error('Invalid date');
    }
    const normalized = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    normalized.setHours(0, 0, 0, 0);
    return normalized;
}

function buildDueInMonth(year: number, monthIndex: number, paymentDueDay: number): TuitionDueDateParts {
    const day = Math.max(1, Math.min(31, Math.round(paymentDueDay)));
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const adjustedDueDay = Math.min(day, daysInMonth);
    const dueDate = new Date(year, monthIndex, adjustedDueDay);
    dueDate.setHours(0, 0, 0, 0);
    return {
        dueDate,
        dueYear: year,
        dueMonth: monthIndex + 1,
        adjustedDueDay
    };
}

/**
 * Próximo vencimento de mensalidade: ainda neste mês se o dia não passou; senão no mês seguinte.
 * Ex.: hoje 22/05 e dia 25 → 25/05; hoje 26/05 e dia 25 → 25/06.
 */
export function resolveNextTuitionDueDate(referenceDate: Date, paymentDueDay: number): TuitionDueDateParts {
    const today = startOfLocalDay(referenceDate);
    let year = today.getFullYear();
    let monthIndex = today.getMonth();

    let candidate = buildDueInMonth(year, monthIndex, paymentDueDay);
    if (candidate.dueDate.getTime() < today.getTime()) {
        monthIndex += 1;
        if (monthIndex > 11) {
            monthIndex = 0;
            year += 1;
        }
        candidate = buildDueInMonth(year, monthIndex, paymentDueDay);
    }

    return candidate;
}

export function daysUntilTuitionDue(referenceDate: Date, dueDate: Date): number {
    const today = startOfLocalDay(referenceDate);
    const due = startOfLocalDay(dueDate);
    return Math.floor((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/** Gera cobrança quando faltam entre 0 e `daysBefore` dias para o próximo vencimento. */
export function shouldGenerateTuitionChargeInWindow(
    referenceDate: Date,
    paymentDueDay: number,
    daysBefore: number
): boolean {
    const { dueDate } = resolveNextTuitionDueDate(referenceDate, paymentDueDay);
    const diffDays = daysUntilTuitionDue(referenceDate, dueDate);
    return diffDays >= 0 && diffDays <= daysBefore;
}
