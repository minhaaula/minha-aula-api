/**
 * Classificação de lembretes de cobrança (mensalidade) para escolha do template Twilio.
 */

export type MensalidadeReminderKind = 'overdue' | 'due_today' | 'upcoming';

export function classifyMensalidadeReminderKind(dueDate: Date, referenceDay: Date): MensalidadeReminderKind {
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    const r = new Date(referenceDay);
    r.setHours(0, 0, 0, 0);
    if (d.getTime() < r.getTime()) {
        return 'overdue';
    }
    if (d.getTime() === r.getTime()) {
        return 'due_today';
    }
    return 'upcoming';
}

function parsePtBrDateString(s: string): Date | null {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
    if (!m) {
        return null;
    }
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date;
}

/** Jobs antigos sem `chargeReminderKind`: infere a partir de `dueDate` (dd/mm/aaaa). */
export function inferMensalidadeReminderKindFromCobrancaPayload(
    cobranca: Record<string, unknown>,
    now: Date = new Date()
): MensalidadeReminderKind {
    const k = cobranca.chargeReminderKind;
    if (k === 'overdue' || k === 'due_today' || k === 'upcoming') {
        return k;
    }
    const dueStr = typeof cobranca.dueDate === 'string' ? cobranca.dueDate : '';
    const parsed = parsePtBrDateString(dueStr);
    if (!parsed) {
        return 'upcoming';
    }
    return classifyMensalidadeReminderKind(parsed, now);
}
