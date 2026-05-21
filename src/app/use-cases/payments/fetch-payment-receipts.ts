import { SchoolPlanInvoiceRepository } from '../../../ports/repositories/school-plan-invoice.repo';
import { SchoolPlanFinanceRepository } from '../../../ports/repositories/school-plan-finance.repo';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { OutboxRepository } from '../../../ports/repositories/outbox.repo';
import { AsaasProviderPort } from '../../../ports/providers/asaas-port';
import { log } from '../../../shared/logger';

export interface FetchPaymentReceiptsInput {
    limit?: number;
}

export interface FetchPaymentReceiptsOutput {
    processed: number;
    updated: number;
    errors: number;
    accountsCreated: number;
}

export class FetchPaymentReceipts {
    constructor(
        private readonly invoices: SchoolPlanInvoiceRepository,
        private readonly finances: SchoolPlanFinanceRepository,
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort,
        private readonly outbox?: OutboxRepository
    ) {}

    async exec(input: FetchPaymentReceiptsInput = {}): Promise<FetchPaymentReceiptsOutput> {
        const limit = input.limit ?? 50;
        
        if (!this.asaasProvider?.getPayment) {
            return {
                processed: 0,
                updated: 0,
                errors: 0,
                accountsCreated: 0
            };
        }

        // Buscar invoices pagas sem receiptUrl e com providerRef
        const invoicesToProcess = await this.invoices.findPaidWithoutReceiptUrl(limit);
        
        let processed = 0;
        let updated = 0;
        let errors = 0;
        let accountsCreated = 0;

        for (const invoice of invoicesToProcess) {
            processed++;
            
            // Só processar se tiver providerRef
            if (!invoice.providerRef) {
                continue;
            }

            try {
                // Buscar recibo no Asaas
                const paymentDetails = await this.asaasProvider.getPayment(invoice.providerRef);
                
                if (paymentDetails.transactionReceiptUrl) {
                    // Atualizar invoice com receiptUrl
                    const updatedInvoice = invoice.withChanges({
                        receiptUrl: paymentDetails.transactionReceiptUrl,
                        updatedAt: new Date()
                    });
                    await this.invoices.save(updatedInvoice);
                    updated++;

                    // Primeira parcela e escola sem conta: enfileirar ensure_school_asaas_account (mesmo fluxo do webhook)
                    const allInvoices = await this.invoices.findByFinanceId(invoice.financeId);
                    const sortedInvoices = allInvoices.sort((a, b) =>
                        a.dueDate.getTime() - b.dueDate.getTime()
                    );
                    const isFirstInvoice = sortedInvoices.length > 0 && sortedInvoices[0].id === invoice.id;
                    if (isFirstInvoice && this.outbox) {
                        const school = await this.schools.findById(invoice.schoolId);
                        if (school && !school.accountId) {
                            await this.outbox.enqueue({
                                type: 'ensure_school_asaas_account',
                                payload: { invoiceId: invoice.id },
                                aggregateId: invoice.schoolId
                            });
                            accountsCreated++;
                        }
                    }
                }
            } catch (error) {
                log.error('Failed to fetch receipt for invoice', { invoiceId: invoice.id, error: error instanceof Error ? error.message : String(error) });
                errors++;
            }
        }

        return {
            processed,
            updated,
            errors,
            accountsCreated
        };
    }
}
