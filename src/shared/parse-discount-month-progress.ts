export type DiscountMonthProgress = {
    /** Ex.: "1 de 2", "3 de 10" */
    label: string;
    current: number;
    total: number;
};

/**
 * Extrai o progresso do desconto a partir de `discount_reason` persistido na cobrança
 * (ex.: "Desconto aplicado (2 de 3 meses)").
 */
export function parseDiscountMonthProgress(
    discountReason: string | null | undefined,
    discountCents: number | null | undefined
): DiscountMonthProgress | null {
    if (discountCents == null || discountCents <= 0) {
        return null;
    }

    const raw = discountReason?.trim() ?? '';
    const match = /\((\d+)\s+de\s+(\d+)/.exec(raw);
    if (!match) {
        return null;
    }

    const current = Number(match[1]);
    const total = Number(match[2]);
    if (
        !Number.isInteger(current) ||
        !Number.isInteger(total) ||
        current < 1 ||
        total < 1 ||
        current > total
    ) {
        return null;
    }

    return {
        label: `${current} de ${total}`,
        current,
        total
    };
}

/** Texto para exibição com unidade (ex.: "1 de 2 meses", "1 de 1 mês"). */
export function formatDiscountMonthsLabel(progress: DiscountMonthProgress | null): string | null {
    if (!progress) {
        return null;
    }
    const unit = progress.total === 1 ? 'mês' : 'meses';
    return `${progress.current} de ${progress.total} ${unit}`;
}
