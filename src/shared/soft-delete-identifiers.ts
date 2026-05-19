/**
 * Gera identificadores substitutos ao liberar e-mail/CPF/CNPJ em soft delete,
 * preservando unicidade no banco e permitindo novo cadastro com os dados originais.
 */
export function buildReleasedEmail(entityId: string): string {
    const compact = entityId.replace(/-/g, '').toLowerCase();
    return `deleted.${compact}@removed.local`;
}

export function buildReleasedCpf(entityId: string): string {
    const digits = entityId.replace(/\D/g, '');
    const base = (digits + '00000000000').slice(0, 11);
    return base.startsWith('0') ? `9${base.slice(1)}` : base;
}

export function buildReleasedCnpj(entityId: string): string {
    const digits = entityId.replace(/\D/g, '');
    return (digits + '00000000000000').slice(0, 14);
}
