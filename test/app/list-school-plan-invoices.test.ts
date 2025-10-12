import { describe, expect, it } from 'vitest';
import { ListSchoolPlanInvoices } from '../../src/app/use-cases/list-school-plan-invoices';
import { SchoolPlanFinanceRepository } from '../../src/ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceRepository } from '../../src/ports/repositories/school-plan-invoice.repo';
import { SchoolPlanFinance } from '../../src/domain/entities/school-plan-finance';
import { SchoolPlanInvoice } from '../../src/domain/entities/school-plan-invoice';
import { SubscriptionPlan } from '../../src/domain/entities/subscription-plan';

class FinanceRepo implements SchoolPlanFinanceRepository {
    private finance: SchoolPlanFinance | null = null;

    async findById(id: string): Promise<SchoolPlanFinance | null> {
        if (this.finance && this.finance.id === id) return this.finance;
        return null;
    }

    async findActiveBySchoolId(schoolId: string): Promise<SchoolPlanFinance | null> {
        if (this.finance && this.finance.schoolId === schoolId) return this.finance;
        return null;
    }

    async save(finance: SchoolPlanFinance): Promise<void> {
        this.finance = finance;
    }

    seed(finance: SchoolPlanFinance) {
        this.finance = finance;
    }
}

class InvoiceRepo implements SchoolPlanInvoiceRepository {
    private readonly items: SchoolPlanInvoice[] = [];

    async findByFinanceIdAndDueDate(): Promise<SchoolPlanInvoice | null> {
        return null;
    }

    async findByProviderRef(): Promise<SchoolPlanInvoice | null> {
        return null;
    }

    async findByExternalReference(): Promise<SchoolPlanInvoice | null> {
        return null;
    }

    async findByFinanceId(financeId: string): Promise<SchoolPlanInvoice[]> {
        return this.items.filter((item) => item.financeId === financeId);
    }

    async save(invoice: SchoolPlanInvoice): Promise<void> {
        this.items.push(invoice);
    }

    seed(invoice: SchoolPlanInvoice) {
        this.items.push(invoice);
    }
}

function makePlan() {
    return SubscriptionPlan.create({
        id: 'plan-x',
        code: 'PREMIUM',
        name: 'Premium',
        amountCents: 25000,
        currency: 'BRL'
    });
}

describe('ListSchoolPlanInvoices', () => {
    it('returns invoices for the active school plan', async () => {
        const financeRepo = new FinanceRepo();
        const invoiceRepo = new InvoiceRepo();
        const plan = makePlan();

        const finance = SchoolPlanFinance.create({
            id: 'finance-x',
            schoolId: 'school-1',
            plan,
            status: 'ACTIVE',
            isPaid: false
        });
        financeRepo.seed(finance);

        const invoice = SchoolPlanInvoice.create({
            id: 'invoice-x',
            financeId: finance.id,
            schoolId: finance.schoolId,
            planId: plan.id,
            amountCents: plan.amountCents,
            currency: plan.currency,
            dueDate: new Date('2024-05-10T00:00:00Z')
        });
        invoiceRepo.seed(invoice);

        const useCase = new ListSchoolPlanInvoices(financeRepo, invoiceRepo);
        const result = await useCase.exec({ schoolId: finance.schoolId });

        expect(result.invoices).toHaveLength(1);
        expect(result.invoices[0].id).toBe(invoice.id);
    });

    it('returns empty list when school has no active plan', async () => {
        const useCase = new ListSchoolPlanInvoices(new FinanceRepo(), new InvoiceRepo());
        const result = await useCase.exec({ schoolId: 'unknown' });
        expect(result.invoices).toHaveLength(0);
    });
});
