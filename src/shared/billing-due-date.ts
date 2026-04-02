/** Fuso para “dia civil” de vencimento / hoje (Brasil, configurável via APP_TIMEZONE). */
const DEFAULT_APP_TIMEZONE = (): string => process.env.APP_TIMEZONE?.trim() || 'America/Sao_Paulo';

/**
 * Ano / mês (1–12) / dia no fuso informado (ex.: dia civil do usuário no Brasil).
 */
export function getCalendarYmdInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    const d = Number(parts.find((p) => p.type === 'day')?.value);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
        return { year: 1970, month: 1, day: 1 };
    }
    return { year: y, month: m, day: d };
}

function ymdToStamp(y: number, m: number, d: number): number {
    return y * 10000 + m * 100 + d;
}

/**
 * Cobrança em aberto (OPEN/PENDING_SYNC/FAILED): considera atrasada quando o **dia de vencimento**
 * (ano/mês/dia em UTC — alinhado a DATE / meia-noite UTC no banco) é **anterior** ao **dia civil atual**
 * no fuso do app (padrão America/Sao_Paulo).
 *
 * Sem isso, após ~21h no Brasil o instante UTC já é “amanhã” e a comparação só em UTC marcava
 * atraso indevido no mesmo dia civil.
 */
export function isOpenChargeCalendarOverdue(
    dueDate: Date,
    now: Date = new Date(),
    timeZone: string = DEFAULT_APP_TIMEZONE()
): boolean {
    const dueStamp = ymdToStamp(
        dueDate.getUTCFullYear(),
        dueDate.getUTCMonth() + 1,
        dueDate.getUTCDate()
    );
    const today = getCalendarYmdInTimeZone(now, timeZone);
    const todayStamp = ymdToStamp(today.year, today.month, today.day);
    return dueStamp < todayStamp;
}
