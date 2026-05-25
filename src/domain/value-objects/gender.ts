/** Biological/legal sex for profile (optional). */
export const GENDERS = ['MALE', 'FEMALE'] as const;

export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
    MALE: 'Masculino',
    FEMALE: 'Feminino'
};

export function isGender(value: string): value is Gender {
    return (GENDERS as readonly string[]).includes(value);
}

export function parseGender(value: unknown): Gender | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase();
    return isGender(normalized) ? normalized : null;
}

export function listGenders(): Array<{ value: Gender; label: string }> {
    return GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }));
}
