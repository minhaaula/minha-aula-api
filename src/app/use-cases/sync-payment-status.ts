import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { SchoolPlanInvoiceStatus } from '../../domain/entities/school-plan-invoice';
import { SchoolPlanStatus } from '../../domain/entities/school-plan-finance';
import { HandleAsaasPaymentWebhook } from './handle-asaas-payment-webhook';

export interface SyncPaymentStatusInput {
    limit?: number;
    daysAgo?: number;
}

export interface SyncPaymentStatusOutput {
    processed: number;
    updated: number;
    errors: number;
    skipped: number;
}

const SUCCESS_STATUSES = new Set(['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED']);
const OVERDUE_STATUSES = new Set(['OVERDUE']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'REFUNDED', 'CHARGEBACK']);

export class SyncPaymentStatus {
    constructor(
        private readonly invoices: SchoolPlanInvoiceRepository,
        private readonly finances: SchoolPlanFinanceRepository,
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: SyncPaymentStatusInput = {}): Promise<SyncPaymentStatusOutput> {
        const limit = input.limit ?? 50;
        const daysAgo = input.daysAgo ?? 7;

        if (!this.asaasProvider?.getPayment) {
            return {
                processed: 0,
                updated: 0,
                errors: 0,
                skipped: 0
            };
        }

        // Buscar invoices emitidas recentemente com providerRef
        const invoicesToCheck = await this.invoices.findIssuedWithProviderRef(limit, daysAgo);

        let processed = 0;
        let updated = 0;
        let errors = 0;
        let skipped = 0;

        // Usar o handler de webhook para processar atualizações (reutiliza lógica)
        const webhookHandler = new HandleAsaasPaymentWebhook(
            this.invoices,
            this.finances,
            this.schools,
            this.asaasProvider
        );

        for (const invoice of invoicesToCheck) {
            processed++;

            if (!invoice.providerRef) {
                skipped++;
                continue;
            }

            try {
                // Buscar status do pagamento no Asaas
                const paymentDetails = await this.asaasProvider.getPayment(invoice.providerRef);

                if (!paymentDetails.status) {
                    skipped++;
                    continue;
                }

                const status = paymentDetails.status.toUpperCase();

                // Se o status no Asaas indica que foi pago mas nossa invoice ainda está ISSUED
                if (SUCCESS_STATUSES.has(status) && invoice.status === 'ISSUED') {
                    // Simular evento de webhook para processar a atualização
                    const result = await webhookHandler.exec({
                        event: 'PAYMENT_RECEIVED',
                        payment: {
                            id: invoice.providerRef,
                            status: paymentDetails.status,
                            externalReference: invoice.externalReference,
                            paymentDate: paymentDetails.paymentDate ?? null,
                            confirmedDate: paymentDetails.confirmedDate ?? null,
                            receivedDate: paymentDetails.receivedDate ?? null,
                            dueDate: invoice.dueDate.toISOString().slice(0, 10),
                            value: invoice.amountCents / 100
                        }
                    });

                    if (result.handled) {
                        updated++;
                    } else {
                        skipped++;
                    }
                }
                // Se o status no Asaas indica que está vencido mas nossa invoice ainda está ISSUED
                else if (OVERDUE_STATUSES.has(status) && invoice.status === 'ISSUED') {
                    const result = await webhookHandler.exec({
                        event: 'PAYMENT_OVERDUE',
                        payment: {
                            id: invoice.providerRef,
                            status: paymentDetails.status,
                            externalReference: invoice.externalReference,
                            paymentDate: null,
                            confirmedDate: null,
                            receivedDate: null,
                            dueDate: invoice.dueDate.toISOString().slice(0, 10),
                            value: invoice.amountCents / 100
                        }
                    });

                    if (result.handled) {
                        updated++;
                    } else {
                        skipped++;
                    }
                }
                // Se o status no Asaas indica que foi cancelado mas nossa invoice ainda está ISSUED
                else if (CANCELLED_STATUSES.has(status) && invoice.status === 'ISSUED') {
                    const result = await webhookHandler.exec({
                        event: 'PAYMENT_CANCELED',
                        payment: {
                            id: invoice.providerRef,
                            status: paymentDetails.status,
                            externalReference: invoice.externalReference,
                            paymentDate: null,
                            confirmedDate: null,
                            receivedDate: null,
                            dueDate: invoice.dueDate.toISOString().slice(0, 10),
                            value: invoice.amountCents / 100
                        }
                    });

                    if (result.handled) {
                        updated++;
                    } else {
                        skipped++;
                    }
                }
                // Se o status já está sincronizado, pular
                else {
                    skipped++;
                }
            } catch (error) {
                console.error(`Failed to sync payment status for invoice ${invoice.id}:`, error);
                errors++;
            }
        }

        return {
            processed,
            updated,
            errors,
            skipped
        };
    }
}
