/**
 * Validações de transições de estado para entidades
 */

export type SchoolPlanInvoiceStatus = 'ISSUED' | 'PAID' | 'FAILED' | 'CANCELLED';
export type SchoolPlanFinanceStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

/**
 * Transições permitidas para SchoolPlanInvoice
 */
const INVOICE_ALLOWED_TRANSITIONS: Record<SchoolPlanInvoiceStatus, SchoolPlanInvoiceStatus[]> = {
    ISSUED: ['PAID', 'FAILED', 'CANCELLED'],
    PAID: ['CANCELLED'], // Apenas estorno
    FAILED: ['ISSUED', 'CANCELLED'], // Pode reemitir ou cancelar
    CANCELLED: [] // Estado final
};

/**
 * Transições permitidas para SchoolPlanFinance
 */
const FINANCE_ALLOWED_TRANSITIONS: Record<SchoolPlanFinanceStatus, SchoolPlanFinanceStatus[]> = {
    TRIAL: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['PAST_DUE', 'SUSPENDED', 'CANCELLED'],
    PAST_DUE: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
    SUSPENDED: ['ACTIVE', 'CANCELLED'],
    CANCELLED: [] // Estado final
};

/**
 * Valida se a transição de status é permitida para invoice
 */
export function validateInvoiceStatusTransition(
    currentStatus: SchoolPlanInvoiceStatus,
    newStatus: SchoolPlanInvoiceStatus
): boolean {
    if (currentStatus === newStatus) {
        return true; // Permite manter o mesmo status (idempotência)
    }
    const allowed = INVOICE_ALLOWED_TRANSITIONS[currentStatus] || [];
    return allowed.includes(newStatus);
}

/**
 * Valida se a transição de status é permitida para finance
 */
export function validateFinanceStatusTransition(
    currentStatus: SchoolPlanFinanceStatus,
    newStatus: SchoolPlanFinanceStatus
): boolean {
    if (currentStatus === newStatus) {
        return true; // Permite manter o mesmo status (idempotência)
    }
    const allowed = FINANCE_ALLOWED_TRANSITIONS[currentStatus] || [];
    return allowed.includes(newStatus);
}

/**
 * Obtém mensagem de erro para transição inválida de invoice
 */
export function getInvoiceTransitionError(
    currentStatus: SchoolPlanInvoiceStatus,
    newStatus: SchoolPlanInvoiceStatus
): string {
    return `Transição de status inválida para invoice: ${currentStatus} -> ${newStatus}. Transições permitidas: ${INVOICE_ALLOWED_TRANSITIONS[currentStatus]?.join(', ') || 'nenhuma'}`;
}

/**
 * Obtém mensagem de erro para transição inválida de finance
 */
export function getFinanceTransitionError(
    currentStatus: SchoolPlanFinanceStatus,
    newStatus: SchoolPlanFinanceStatus
): string {
    return `Transição de status inválida para finance: ${currentStatus} -> ${newStatus}. Transições permitidas: ${FINANCE_ALLOWED_TRANSITIONS[currentStatus]?.join(', ') || 'nenhuma'}`;
}
