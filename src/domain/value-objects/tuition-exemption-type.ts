/** Reason for tuition exemption (`monthlyTuition: EXEMPT`). */
export const TUITION_EXEMPTION_TYPES = [
    'EMPLOYEE',
    'RELATIVE',
    'SCHOLARSHIP',
    'NONPROFIT'
] as const;

export type TuitionExemptionType = (typeof TUITION_EXEMPTION_TYPES)[number];

export function isTuitionExemptionType(value: string): value is TuitionExemptionType {
    return (TUITION_EXEMPTION_TYPES as readonly string[]).includes(value);
}

export function parseTuitionExemptionType(value: unknown): TuitionExemptionType | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase();
    return isTuitionExemptionType(normalized) ? normalized : null;
}
