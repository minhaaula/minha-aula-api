export function normalizeUuid(value: string): string {
    return value.trim().toLowerCase();
}

export function equalUuid(a: string, b: string): boolean {
    return normalizeUuid(a) === normalizeUuid(b);
}
