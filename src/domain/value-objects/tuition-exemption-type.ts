/** Reason for tuition exemption (`monthlyTuition: EXEMPT`). */
export const TUITION_EXEMPTION_TYPES = [
    'EMPLOYEE',
    'RELATIVE',
    'SCHOLARSHIP',
    'NONPROFIT'
] as const;

export type TuitionExemptionType = (typeof TUITION_EXEMPTION_TYPES)[number];

export type TuitionExemptionTypeOption = {
    value: TuitionExemptionType;
    label: string;
};

/** Labels em português para exibição na UI (valor da API permanece em inglês). */
export const TUITION_EXEMPTION_TYPE_LABELS: Record<TuitionExemptionType, string> = {
    EMPLOYEE: 'Funcionário',
    RELATIVE: 'Parente',
    SCHOLARSHIP: 'Bolsa de estudos',
    NONPROFIT: 'Instituição sem fins lucrativos'
};

export function listTuitionExemptionTypes(): TuitionExemptionTypeOption[] {
    return TUITION_EXEMPTION_TYPES.map((value) => ({
        value,
        label: TUITION_EXEMPTION_TYPE_LABELS[value]
    }));
}

export function getTuitionExemptionTypeLabel(value: TuitionExemptionType | null | undefined): string | null {
    if (!value) return null;
    return TUITION_EXEMPTION_TYPE_LABELS[value] ?? null;
}

export function isTuitionExemptionType(value: string): value is TuitionExemptionType {
    return (TUITION_EXEMPTION_TYPES as readonly string[]).includes(value);
}

export function parseTuitionExemptionType(value: unknown): TuitionExemptionType | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase();
    return isTuitionExemptionType(normalized) ? normalized : null;
}
