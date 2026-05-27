/**
 * Converte valores monetários do Asaas (reais, ex.: `netValue: 29.01`) para centavos.
 * Aceita number ou string (JSON às vezes serializa número como string).
 */
export function parseAsaasReaisToCents(value: unknown): number | null {
    if (value == null || value === '') {
        return null;
    }
    let amount: number;
    if (typeof value === 'number') {
        amount = value;
    } else if (typeof value === 'string') {
        const trimmed = value.trim().replace(',', '.');
        amount = Number(trimmed);
    } else {
        return null;
    }
    if (!Number.isFinite(amount)) {
        return null;
    }
    return Math.round(amount * 100);
}
