export type ChargeDueReminderType = 'SCHOOL_FINANCIAL_CHARGE' | 'SCHOOL_PLAN_INVOICE';

export interface ChargeDueReminderRepository {
    /** Verifica se já foi enviado lembrete para esta cobrança/fatura. */
    wasReminderSent(chargeType: ChargeDueReminderType, chargeId: string): Promise<boolean>;
    /** Registra que o lembrete foi enviado (evita reenvio). */
    markReminderSent(chargeType: ChargeDueReminderType, chargeId: string): Promise<void>;
}
