/**
 * Utilitários para manipulação de datas com foco em consistência UTC
 */

/** Converte valor do ORM/driver (Date, ISO string, timestamp) em `Date` válido. */
export function coerceToDate(value: unknown): Date | null {
    if (value == null || value === '') {
        return null;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        if (dateOnly) {
            const year = Number(dateOnly[1]);
            const month = Number(dateOnly[2]);
            const day = Number(dateOnly[3]);
            const parsed = new Date(year, month - 1, day);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

/**
 * Normaliza uma data para UTC, removendo informações de hora
 * Útil para comparações de datas de vencimento, onde apenas o dia importa
 */
export function toUtcDateOnly(date: Date): Date {
    return new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
    ));
}

/**
 * Cria uma data UTC a partir de ano, mês e dia
 */
export function createUtcDate(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day)); // month é 1-12, Date.UTC usa 0-11
}

/**
 * Obtém a data de hoje normalizada para UTC (sem hora)
 */
export function getTodayUtc(): Date {
    return toUtcDateOnly(new Date());
}

/**
 * Compara duas datas apenas pelo dia (ignora hora)
 * Retorna:
 * - negativo se date1 < date2
 * - zero se date1 === date2
 * - positivo se date1 > date2
 */
export function compareDates(date1: Date, date2: Date): number {
    const d1 = toUtcDateOnly(date1);
    const d2 = toUtcDateOnly(date2);
    return d1.getTime() - d2.getTime();
}

/**
 * Verifica se duas datas são do mesmo mês/ano (ignora dia e hora)
 */
export function isSameMonthYear(date1: Date, date2: Date): boolean {
    const d1 = toUtcDateOnly(date1);
    const d2 = toUtcDateOnly(date2);
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth();
}

/**
 * Extrai o dia do mês em UTC (1-31)
 */
export function getUtcDay(date: Date): number {
    return date.getUTCDate();
}

/**
 * Extrai o mês em UTC (1-12)
 */
export function getUtcMonth(date: Date): number {
    return date.getUTCMonth() + 1; // getUTCMonth retorna 0-11
}

/**
 * Extrai o ano em UTC
 */
export function getUtcYear(date: Date): number {
    return date.getUTCFullYear();
}
