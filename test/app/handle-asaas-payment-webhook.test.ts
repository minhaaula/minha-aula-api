import { describe, expect, it } from 'vitest';
import { HandleAsaasPaymentWebhook } from '../../src/app/use-cases/handle-asaas-payment-webhook';
import { SchoolPlanInvoiceRepository } from '../../src/ports/repositories/school-plan-invoice.repo';
import { SchoolPlanInvoice } from '../../src/domain/entities/school-plan-invoice';
import { SchoolPlanFinanceRepository } from '../../src/ports/repositories/school-plan-finance.repo';
import { SchoolPlanFinance } from '../../src/domain/entities/school-plan-finance';
import { SubscriptionPlan } from '../../src/domain/entities/subscription-plan';

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

        const useCase = new HandleAsaasPaymentWebhook(invoices, finances);
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

    it('marks invoice as cancelled when payment is deleted', async () => {
        const invoices = new InMemoryInvoiceRepo();
        const finances = new InMemoryFinanceRepo();
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

        const useCase = new HandleAsaasPaymentWebhook(invoices, finances);
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
});
