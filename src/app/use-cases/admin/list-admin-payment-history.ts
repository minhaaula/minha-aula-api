import type { SchoolPlanInvoiceRepository } from '../../../ports/repositories/school-plan-invoice.repo';
import type { PaymentHistoryFilters, PaymentHistoryResult } from '../../../ports/repositories/school-plan-invoice.repo';
import type { AsaasProviderPort } from '../../../ports/providers/asaas-port';

export type ListAdminPaymentHistoryInput = {
    schoolName?: string | null;
    status?: string | null;
    month?: number | null;
    year?: number | null;
    limit?: number;
    offset?: number;
};

/** Saldo disponível na Asaas (conta principal). Em reais. */
export type PaymentHistorySummary = {
    /** Saldo disponível na Asaas (nossa empresa), em reais. null se indisponível. */
    balanceAvailableReais: number | null;
    /** Valor total recebido (nossa empresa), em centavos. */
    totalReceivedCents: number;
    /** Valor total atrasado (nossa empresa), em centavos. */
    totalOverdueCents: number;
};

export type ListAdminPaymentHistoryOutput = PaymentHistoryResult & {
    summary?: PaymentHistorySummary;
};

export class ListAdminPaymentHistory {
    constructor(
        private readonly invoices: SchoolPlanInvoiceRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: ListAdminPaymentHistoryInput): Promise<ListAdminPaymentHistoryOutput> {
        const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
        const offset = Math.max(0, input.offset ?? 0);

        const findPaginated = this.invoices.findPaymentHistoryPaginated;
        if (!findPaginated) {
            const base = { items: [], total: 0, limit, offset };
            const summary = await this.loadSummary();
            return summary ? { ...base, summary } : base;
        }

        const [result, summary] = await Promise.all([
            findPaginated.call(this.invoices, {
                schoolName: input.schoolName ?? null,
                status: input.status ?? null,
                month: input.month ?? null,
                year: input.year ?? null
            }, limit, offset),
            this.loadSummary()
        ]);

        return summary ? { ...result, summary } : result;
    }

    private async loadSummary(): Promise<PaymentHistorySummary | null> {
        const getTotals = this.invoices.getPaymentHistoryTotals;
        if (!getTotals) return null;

        const totals = await getTotals.call(this.invoices);

        let balanceAvailableReais: number | null = null;
        if (this.asaasProvider?.getMainAccountBalance) {
            try {
                const balance = await this.asaasProvider.getMainAccountBalance();
                balanceAvailableReais = balance.balance;
            } catch {
                balanceAvailableReais = null;
            }
        }

        return {
            balanceAvailableReais,
            totalReceivedCents: totals.totalReceivedCents,
            totalOverdueCents: totals.totalOverdueCents
        };
    }
}
