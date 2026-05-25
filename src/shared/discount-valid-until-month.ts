const MONTH_SHORT_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

/**
 * Último mês civil com desconto (ex.: "Mai", "Jun"), a partir da data de matrícula e da quantidade de meses.
 */
export function resolveDiscountValidUntilMonthLabel(
    enrolledAt: Date,
    discountMonths: number | null | undefined
): string | null {
    if (discountMonths == null || discountMonths < 1) {
        return null;
    }
    const start = new Date(enrolledAt);
    if (Number.isNaN(start.getTime())) {
        return null;
    }
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + discountMonths, 0));
    return MONTH_SHORT_PT[end.getUTCMonth()] ?? null;
}
