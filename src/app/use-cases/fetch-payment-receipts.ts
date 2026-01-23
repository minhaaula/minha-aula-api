import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';

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
        private readonly asaasProvider?: AsaasProviderPort
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

                    // Verificar se é a primeira parcela e se a escola não tem conta Asaas
                    const allInvoices = await this.invoices.findByFinanceId(invoice.financeId);
                    const sortedInvoices = allInvoices.sort((a, b) => 
                        a.dueDate.getTime() - b.dueDate.getTime()
                    );
                    
                    const isFirstInvoice = sortedInvoices.length > 0 && 
                        sortedInvoices[0].id === invoice.id;

                    if (isFirstInvoice && this.asaasProvider.createSubAccount) {
                        const school = await this.schools.findById(invoice.schoolId);
                        if (school && !school.accountId) {
                            // Criar conta Asaas para a escola
                            try {
                                if (school.addresses.length > 0) {
                                    const mainAddress = school.addresses[0];
                                    if (mainAddress.street && mainAddress.number && 
                                        mainAddress.zipCode && mainAddress.zipCode.length === 8) {
                                        
                                        const companyType = 'LIMITED';
                                        const incomeValue = school.incomeValue && school.incomeValue > 0 
                                            ? school.incomeValue 
                                            : 5000;

                                        const subAccount = await this.asaasProvider.createSubAccount({
                                            name: school.name,
                                            email: school.email,
                                            cpfCnpj: school.cnpj,
                                            phone: school.phone,
                                            externalReference: school.id,
                                            companyType,
                                            incomeValue,
                                            address: mainAddress.street,
                                            addressNumber: mainAddress.number,
                                            complement: mainAddress.complement ?? null,
                                            province: mainAddress.district ?? null,
                                            postalCode: mainAddress.zipCode
                                        });

                                        // Atualizar escola com accountId, accountApiKey e walletId
                                        let updatedSchool = school.withAccountId(subAccount.id);
                                        if (subAccount.apiKey) {
                                            updatedSchool = updatedSchool.withAccountApiKey(subAccount.apiKey);
                                        }
                                        if (subAccount.walletId) {
                                            updatedSchool = updatedSchool.withWalletId(subAccount.walletId);
                                        }
                                        await this.schools.save(updatedSchool);
                                        accountsCreated++;
                                    }
                                }
                            } catch (accountError) {
                                console.error(`Failed to create Asaas account for school ${invoice.schoolId}:`, accountError);
                                // Não incrementar errors aqui, pois o recibo foi atualizado com sucesso
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Failed to fetch receipt for invoice ${invoice.id}:`, error);
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
