import type { SchoolPaymentStatusDisplay } from '../app/types/payment.types';

type ChargeSortable = {
    statusDisplay: SchoolPaymentStatusDisplay;
    dueDate: Date;
    paidAt?: Date | null;
    createdAt?: Date;
};

/** Prioridade: Atrasado (0) → Pendente (1) → demais (2). */
export function schoolChargeStatusRank(statusDisplay: SchoolPaymentStatusDisplay): number {
    if (statusDisplay === 'Atrasado') return 0;
    if (statusDisplay === 'Pendente') return 1;
    return 2;
}

/** Ordenação padrão da listagem escola: status, vencimento mais recente, depois pagamento. */
export function compareSchoolChargesByDisplayStatusAndDueDate(a: ChargeSortable, b: ChargeSortable): number {
    const byStatus = schoolChargeStatusRank(a.statusDisplay) - schoolChargeStatusRank(b.statusDisplay);
    if (byStatus !== 0) return byStatus;

    const byDueDate = b.dueDate.getTime() - a.dueDate.getTime();
    if (byDueDate !== 0) return byDueDate;

    const aTieBreak = a.paidAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
    const bTieBreak = b.paidAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
    return bTieBreak - aTieBreak;
}

export function sortSchoolChargesByDisplayStatusAndDueDate<T extends ChargeSortable>(items: T[]): T[] {
    return [...items].sort(compareSchoolChargesByDisplayStatusAndDueDate);
}
