import { describe, expect, it } from 'vitest';
import { HandleAsaasPaymentWebhook } from '../../src/app/use-cases/payments/handle-asaas-payment-webhook';
import { SchoolPlanInvoiceRepository } from '../../src/ports/repositories/school-plan-invoice.repo';
import { SchoolPlanInvoice } from '../../src/domain/entities/school-plan-invoice';
import { SchoolPlanFinanceRepository } from '../../src/ports/repositories/school-plan-finance.repo';
import { SchoolPlanFinance } from '../../src/domain/entities/school-plan-finance';
import { SubscriptionPlan } from '../../src/domain/entities/subscription-plan';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { School } from '../../src/domain/entities/school';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { OutboxRepository } from '../../src/ports/repositories/outbox.repo';
import { SchoolFinancialChargeRepository } from '../../src/ports/repositories/school-financial-charge.repo';
import { SchoolFinancialCharge } from '../../src/domain/entities/school-financial-charge';

class InMemoryInvoiceRepo implements SchoolPlanInvoiceRepository {
    private readonly items = new Map<string, SchoolPlanInvoice>();

    async findByFinanceIdAndDueDate(financeId: string, dueDate: Date): Promise<SchoolPlanInvoice | null> {
        const key = dueDate.toISOString().slice(0, 10);
        return (
            Array.from(this.items.values()).find((item) => item.financeId === financeId && item.dueDate.toISOString().slice(0, 10) === key) ?? null
        );
    }

    async findByProviderRef(providerRef: string): Promise<SchoolPlanInvoice | null> {
        const normalized = providerRef.trim();
        return Array.from(this.items.values()).find((item) => item.providerRef === normalized) ?? null;
    }

    async findByExternalReference(externalReference: string): Promise<SchoolPlanInvoice | null> {
        const normalized = externalReference.trim();
        return Array.from(this.items.values()).find((item) => item.externalReference === normalized) ?? null;
    }

    async findById(): Promise<SchoolPlanInvoice | null> {
        return null;
    }

    async hasSchoolAnyPaidInvoice(): Promise<boolean> {
        return false;
    }

    async getSchoolIdsWithPaidInvoice(): Promise<Set<string>> {
        return new Set();
    }

    async findByFinanceId(): Promise<SchoolPlanInvoice[]> {
        return [];
    }

    async countByFinanceIdAndDiscountCouponId(): Promise<number> {
        return 0;
    }

    async findPaidWithoutReceiptUrl(): Promise<SchoolPlanInvoice[]> {
        return [];
    }

    async findIssuedWithProviderRef(): Promise<SchoolPlanInvoice[]> {
        return [];
    }

    async findIssuedByDueDateRange(): Promise<SchoolPlanInvoice[]> {
        return [];
    }

    async save(invoice: SchoolPlanInvoice): Promise<void> {
        this.items.set(invoice.id, invoice);
    }

    seed(invoice: SchoolPlanInvoice) {
        this.items.set(invoice.id, invoice);
    }
}

class InMemoryFinanceRepo implements SchoolPlanFinanceRepository {
    private readonly items = new Map<string, SchoolPlanFinance>();

    async findById(id: string): Promise<SchoolPlanFinance | null> {
        return this.items.get(id) ?? null;
    }

    async findActiveBySchoolId(schoolId: string): Promise<SchoolPlanFinance | null> {
        return Array.from(this.items.values()).find((item) => item.schoolId === schoolId) ?? null;
    }

    async save(finance: SchoolPlanFinance): Promise<void> {
        this.items.set(finance.id, finance);
    }

    seed(finance: SchoolPlanFinance) {
        this.items.set(finance.id, finance);
    }
}

class InMemorySchoolRepo implements SchoolRepository {
    private readonly items = new Map<string, School>();

    async findById(id: string): Promise<School | null> {
        return this.items.get(id) ?? null;
    }

    async findAll(): Promise<School[]> {
        return Array.from(this.items.values());
    }

    async save(school: School): Promise<void> {
        this.items.set(school.id, school);
    }

    seed(school: School) {
        this.items.set(school.id, school);
    }
}

class CapturingOutbox implements OutboxRepository {
    public readonly events: Array<{ type: string; payload: unknown; aggregateId: string }> = [];

    async enqueue(event: { type: string; payload: unknown; aggregateId: string }): Promise<void> {
        this.events.push(event);
    }
}

class InMemoryFinancialChargesRepo implements SchoolFinancialChargeRepository {
    private readonly items = new Map<string, SchoolFinancialCharge>();

    async findById(id: string): Promise<SchoolFinancialCharge | null> {
        return this.items.get(id.trim()) ?? null;
    }

    async findByAsaasPaymentId(paymentId: string): Promise<SchoolFinancialCharge | null> {
        const needle = paymentId.trim();
        return Array.from(this.items.values()).find((c) => c.asaasPaymentId === needle) ?? null;
    }

    async save(charge: SchoolFinancialCharge): Promise<void> {
        this.items.set(charge.id, charge);
    }

    seed(charge: SchoolFinancialCharge): void {
        this.items.set(charge.id, charge);
    }
}

function makePlan() {
    return SubscriptionPlan.create({
        id: 'plan-1',
        code: 'BASIC',
        name: 'Plano Básico',
        amountCents: 15000,
        currency: 'BRL',
        billingCycle: 'MONTHLY'
    });
}

describe('HandleAsaasPaymentWebhook', () => {
    it('marks invoice as paid when payment is confirmed', async () => {
        const invoices = new InMemoryInvoiceRepo();
        const finances = new InMemoryFinanceRepo();
        const schools = new InMemorySchoolRepo();
        const plan = makePlan();

        const finance = SchoolPlanFinance.create({
            id: 'finance-1',
            schoolId: 'school-1',
            plan,
            status: 'ACTIVE',
            isPaid: false,
            nextDueAt: new Date('2024-06-05T00:00:00Z')
        });
        finances.seed(finance);

        const invoice = SchoolPlanInvoice.create({
            id: 'invoice-1',
            financeId: finance.id,
            schoolId: finance.schoolId,
            planId: plan.id,
            amountCents: plan.amountCents,
            currency: plan.currency,
            dueDate: new Date('2024-05-05T00:00:00Z'),
            providerRef: 'pay-123',
            externalReference: `${finance.id}:2024-05-05`
        });
        invoices.seed(invoice);

        schools.seed(School.create({
            id: finance.schoolId,
            name: 'Escola Teste',
            email: 'school@example.com',
            phone: '47999999999',
            cnpj: '12345678000100',
            addresses: [
                PostalAddress.create({
                    street: 'Rua Central',
                    number: '123',
                    city: 'Joinville',
                    state: 'SC',
                    zipCode: '89200000'
                })
            ]
        }));

        const useCase = new HandleAsaasPaymentWebhook(invoices, finances, schools);
        const result = await useCase.exec({
            event: 'PAYMENT_CONFIRMED',
            payment: {
                id: 'pay-123',
                status: 'RECEIVED',
                paymentDate: '2024-05-06T12:00:00Z'
            }
        });

        expect(result.handled).toBe(true);

        const updatedInvoice = await invoices.findByProviderRef('pay-123');
        expect(updatedInvoice?.status).toBe('PAID');
        expect(updatedInvoice?.paidAt?.toISOString()).toBe('2024-05-06T12:00:00.000Z');

        const updatedFinance = await finances.findById(finance.id);
        expect(updatedFinance?.isPaid).toBe(true);
        expect(updatedFinance?.status).toBe('ACTIVE');
        expect(updatedFinance?.lastPaymentAt?.toISOString()).toBe('2024-05-06T12:00:00.000Z');
    });

    it('usa dateCreated do webhook quando paymentDate é só data (Asaas)', async () => {
        const invoices = new InMemoryInvoiceRepo();
        const finances = new InMemoryFinanceRepo();
        const schools = new InMemorySchoolRepo();
        const plan = makePlan();

        const finance = SchoolPlanFinance.create({
            id: 'finance-dateonly',
            schoolId: 'school-dateonly',
            plan,
            status: 'ACTIVE',
            isPaid: false,
            nextDueAt: new Date('2024-06-05T00:00:00Z')
        });
        finances.seed(finance);

        const invoice = SchoolPlanInvoice.create({
            id: 'invoice-dateonly',
            financeId: finance.id,
            schoolId: finance.schoolId,
            planId: plan.id,
            amountCents: plan.amountCents,
            currency: plan.currency,
            dueDate: new Date('2024-05-05T00:00:00Z'),
            providerRef: 'pay-dateonly',
            externalReference: `${finance.id}:2024-05-05`
        });
        invoices.seed(invoice);

        schools.seed(School.create({
            id: finance.schoolId,
            name: 'Escola Data',
            email: 'data@example.com',
            phone: '47999999997',
            cnpj: '12345678000103',
            addresses: [
                PostalAddress.create({
                    street: 'Rua A',
                    number: '1',
                    city: 'Joinville',
                    state: 'SC',
                    zipCode: '89200003'
                })
            ]
        }));

        const useCase = new HandleAsaasPaymentWebhook(invoices, finances, schools);
        const result = await useCase.exec({
            event: 'PAYMENT_RECEIVED',
            eventCreatedAt: '2024-05-06 14:30:00',
            payment: {
                id: 'pay-dateonly',
                status: 'RECEIVED',
                paymentDate: '2024-05-06'
            }
        });

        expect(result.handled).toBe(true);
        const updatedInvoice = await invoices.findByProviderRef('pay-dateonly');
        expect(updatedInvoice?.paidAt?.toISOString()).toBe('2024-05-06T17:30:00.000Z');
    });

    it('marks invoice as cancelled when payment is deleted', async () => {
        const invoices = new InMemoryInvoiceRepo();
        const finances = new InMemoryFinanceRepo();
        const schools = new InMemorySchoolRepo();
        const plan = makePlan();

        const finance = SchoolPlanFinance.create({
            id: 'finance-2',
            schoolId: 'school-2',
            plan,
            status: 'ACTIVE',
            isPaid: false
        });
        finances.seed(finance);

        const invoice = SchoolPlanInvoice.create({
            id: 'invoice-2',
            financeId: finance.id,
            schoolId: finance.schoolId,
            planId: plan.id,
            amountCents: plan.amountCents,
            currency: plan.currency,
            dueDate: new Date('2024-05-10T00:00:00Z'),
            providerRef: 'pay-456'
        });
        invoices.seed(invoice);

        schools.seed(School.create({
            id: finance.schoolId,
            name: 'Escola Teste 2',
            email: 'school2@example.com',
            phone: '47999999998',
            cnpj: '12345678000101',
            addresses: [
                PostalAddress.create({
                    street: 'Rua Secundária',
                    number: '456',
                    city: 'Joinville',
                    state: 'SC',
                    zipCode: '89200001'
                })
            ]
        }));

        const useCase = new HandleAsaasPaymentWebhook(invoices, finances, schools);
        const result = await useCase.exec({
            event: 'PAYMENT_DELETED',
            payment: {
                id: 'pay-456',
                status: 'CANCELLED'
            }
        });

        expect(result.handled).toBe(true);

        const updatedInvoice = await invoices.findByProviderRef('pay-456');
        expect(updatedInvoice?.status).toBe('CANCELLED');

        const updatedFinance = await finances.findById(finance.id);
        expect(updatedFinance?.status).toBe('SUSPENDED');
        expect(updatedFinance?.isPaid).toBe(false);
    });

    it('enfileira ensure_school_asaas_account quando pagamento confirmado (subconta é criada no worker)', async () => {
        const invoices = new InMemoryInvoiceRepo();
        const finances = new InMemoryFinanceRepo();
        const schools = new InMemorySchoolRepo();
        const outbox = new CapturingOutbox();
        const plan = makePlan();

        const finance = SchoolPlanFinance.create({
            id: 'finance-3',
            schoolId: 'school-3',
            plan,
            status: 'ACTIVE',
            isPaid: false,
            nextDueAt: new Date('2024-07-05T00:00:00Z')
        });
        finances.seed(finance);

        schools.seed(School.create({
            id: finance.schoolId,
            name: 'Escola Conta',
            email: 'conta@example.com',
            phone: '47911110000',
            cnpj: '12345678000102',
            incomeValue: 5000,
            addresses: [
                PostalAddress.create({
                    street: 'Rua Mercado',
                    number: '789',
                    city: 'Joinville',
                    state: 'SC',
                    zipCode: '89200002'
                })
            ]
        }));

        const invoice = SchoolPlanInvoice.create({
            id: 'invoice-3',
            financeId: finance.id,
            schoolId: finance.schoolId,
            planId: plan.id,
            amountCents: plan.amountCents,
            currency: plan.currency,
            dueDate: new Date('2024-06-05T00:00:00Z'),
            providerRef: 'pay-789',
            metadata: {}
        });
        invoices.seed(invoice);

        const useCase = new HandleAsaasPaymentWebhook(invoices, finances, schools, undefined, outbox);
        const result = await useCase.exec({
            event: 'PAYMENT_CONFIRMED',
            payment: {
                id: 'pay-789',
                status: 'RECEIVED',
                paymentDate: '2024-06-06T10:00:00Z'
            }
        });

        expect(result.handled).toBe(true);

        const updatedInvoice = await invoices.findByProviderRef('pay-789');
        expect(updatedInvoice?.status).toBe('PAID');

        const job = outbox.events.find((e) => e.type === 'ensure_school_asaas_account');
        expect(job).toBeDefined();
        expect((job!.payload as { invoiceId: string }).invoiceId).toBe(invoice.id);
        expect(job!.aggregateId).toBe(finance.schoolId);
    });

    it('marca cobrança de curso (school_financial_charges) como PAID quando o pagamento é da subconta', async () => {
        const invoices = new InMemoryInvoiceRepo();
        const finances = new InMemoryFinanceRepo();
        const schools = new InMemorySchoolRepo();
        const charges = new InMemoryFinancialChargesRepo();

        const charge = SchoolFinancialCharge.create({
            id: '242207fa-2782-4a15-9b14-27ccbbc6fe0c',
            schoolId: 'school-ch',
            ownerUserId: 'owner-1',
            studentUserId: 'stu-1',
            dependentId: null,
            courseId: 'course-1',
            courseClassId: 'class-1',
            chargeType: 'ENROLLMENT',
            description: 'Matrícula do curso Teste',
            amountCents: 1000,
            dueDate: new Date('2026-05-05')
        });
        charge.markAsSynced({
            paymentId: 'pay_jo7mtae7j4qt0zvw',
            invoiceUrl: 'https://www.asaas.com/i/x',
            payload: {}
        });
        charges.seed(charge);

        const useCase = new HandleAsaasPaymentWebhook(invoices, finances, schools, undefined, undefined, charges);
        const result = await useCase.exec({
            event: 'PAYMENT_RECEIVED',
            payment: {
                id: 'pay_jo7mtae7j4qt0zvw',
                status: 'RECEIVED',
                netValue: 29.01,
                externalReference: charge.id,
                billingType: 'PIX',
                paymentDate: '2026-05-04',
                metadata: { schoolId: charge.schoolId }
            },
            eventCreatedAt: '2026-05-04 17:12:54'
        });

        expect(result.handled).toBe(true);
        const updated = await charges.findById(charge.id);
        expect(updated?.status).toBe('PAID');
        expect(updated?.paymentMethod).toBe('PIX');
        expect(updated?.paidAt).not.toBeNull();
        expect(updated?.providerNetAmountCents).toBe(2901);
    });

    it('aceita netValue como string no webhook', async () => {
        const invoices = new InMemoryInvoiceRepo();
        const finances = new InMemoryFinanceRepo();
        const schools = new InMemorySchoolRepo();
        const charges = new InMemoryFinancialChargesRepo();

        const charge = SchoolFinancialCharge.create({
            id: 'charge-str-net',
            schoolId: 'school-ch',
            ownerUserId: 'owner-1',
            studentUserId: 'stu-1',
            dependentId: null,
            courseId: 'course-1',
            courseClassId: 'class-1',
            chargeType: 'TUITION',
            description: 'Mensalidade',
            amountCents: 5000,
            dueDate: new Date('2026-05-10')
        });
        charge.markAsSynced({ paymentId: 'pay_str', invoiceUrl: null, payload: {} });
        charges.seed(charge);

        const useCase = new HandleAsaasPaymentWebhook(invoices, finances, schools, undefined, undefined, charges);
        await useCase.exec({
            event: 'PAYMENT_RECEIVED',
            payment: {
                id: 'pay_str',
                status: 'RECEIVED',
                netValue: '48.50' as unknown as number,
                externalReference: charge.id,
                billingType: 'PIX'
            }
        });

        const updated = await charges.findById(charge.id);
        expect(updated?.providerNetAmountCents).toBe(4850);
    });

    it('preenche providerNetAmountCents em cobrança já PAID quando chega netValue depois', async () => {
        const invoices = new InMemoryInvoiceRepo();
        const finances = new InMemoryFinanceRepo();
        const schools = new InMemorySchoolRepo();
        const charges = new InMemoryFinancialChargesRepo();

        const charge = SchoolFinancialCharge.create({
            id: 'charge-backfill',
            schoolId: 'school-ch',
            ownerUserId: 'owner-1',
            studentUserId: 'stu-1',
            dependentId: null,
            courseId: 'course-1',
            courseClassId: 'class-1',
            chargeType: 'TUITION',
            description: 'Mensalidade',
            amountCents: 5000,
            dueDate: new Date('2026-05-10')
        });
        charge.markAsSynced({ paymentId: 'pay_bf', invoiceUrl: null, payload: {} });
        charges.seed(charge);

        const useCase = new HandleAsaasPaymentWebhook(invoices, finances, schools, undefined, undefined, charges);

        await useCase.exec({
            event: 'PAYMENT_CONFIRMED',
            payment: {
                id: 'pay_bf',
                status: 'CONFIRMED',
                externalReference: charge.id,
                billingType: 'PIX'
            }
        });

        const afterConfirm = await charges.findById(charge.id);
        expect(afterConfirm?.status).toBe('PAID');
        expect(afterConfirm?.providerNetAmountCents).toBeNull();

        await useCase.exec({
            event: 'PAYMENT_RECEIVED',
            payment: {
                id: 'pay_bf',
                status: 'RECEIVED',
                netValue: 48.5,
                externalReference: charge.id,
                billingType: 'PIX'
            }
        });

        const afterReceived = await charges.findById(charge.id);
        expect(afterReceived?.status).toBe('PAID');
        expect(afterReceived?.providerNetAmountCents).toBe(4850);
    });
});
