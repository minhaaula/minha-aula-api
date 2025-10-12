import { describe, expect, it, vi, afterEach } from 'vitest';
import { AssignSchoolPlan } from '../../src/app/use-cases/assign-school-plan';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { SubscriptionPlanRepository } from '../../src/ports/repositories/subscription-plan.repo';
import { SchoolPlanFinanceRepository } from '../../src/ports/repositories/school-plan-finance.repo';
import { School } from '../../src/domain/entities/school';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { SubscriptionPlan } from '../../src/domain/entities/subscription-plan';
import { SchoolPlanFinance } from '../../src/domain/entities/school-plan-finance';
import { IssueSchoolPlanInvoice } from '../../src/app/use-cases/issue-school-plan-invoice';
import { SchoolPlanInvoiceRepository } from '../../src/ports/repositories/school-plan-invoice.repo';
import { SchoolPlanInvoice } from '../../src/domain/entities/school-plan-invoice';
import { PaymentProviderPort, CreateChargeInput, CreateBoletoChargeInput } from '../../src/ports/providers/payment-provider.port';

class InMemorySchoolRepository implements SchoolRepository {
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

class InMemoryPlanRepository implements SubscriptionPlanRepository {
    private readonly items = new Map<string, SubscriptionPlan>();

    async findActive(): Promise<SubscriptionPlan[]> {
        return Array.from(this.items.values());
    }

    async findById(id: string): Promise<SubscriptionPlan | null> {
        return this.items.get(id) ?? null;
    }

    seed(plan: SubscriptionPlan) {
        this.items.set(plan.id, plan);
    }
}

class InMemoryFinanceRepository implements SchoolPlanFinanceRepository {
    private readonly items = new Map<string, SchoolPlanFinance>();

    async findActiveBySchoolId(schoolId: string): Promise<SchoolPlanFinance | null> {
        return Array.from(this.items.values()).find((item) => item.schoolId === schoolId) ?? null;
    }

    async save(finance: SchoolPlanFinance): Promise<void> {
        this.items.set(finance.id, finance);
    }

    get(schoolId: string) {
        return Array.from(this.items.values()).find((item) => item.schoolId === schoolId);
    }
}

class InMemoryInvoiceRepository implements SchoolPlanInvoiceRepository {
    private readonly items = new Map<string, SchoolPlanInvoice>();

    async findByFinanceIdAndDueDate(financeId: string, dueDate: Date): Promise<SchoolPlanInvoice | null> {
        const target = dueDate.toISOString().slice(0, 10);
        return (
            Array.from(this.items.values()).find(
                (item) => item.financeId === financeId && item.dueDate.toISOString().slice(0, 10) === target
            ) ?? null
        );
    }

    async save(invoice: SchoolPlanInvoice): Promise<void> {
        this.items.set(invoice.id, invoice);
    }

    all() {
        return Array.from(this.items.values());
    }
}

class TestPaymentProvider implements PaymentProviderPort {
    public lastBoletoInput: CreateBoletoChargeInput | null = null;

    async authorize(_input: CreateChargeInput): Promise<{ providerRef: string; }> {
        throw new Error('Not implemented');
    }

    async capture(): Promise<void> {
        throw new Error('Not implemented');
    }

    async createBoletoCharge(input: CreateBoletoChargeInput) {
        this.lastBoletoInput = input;
        return {
            providerRef: 'asaas-1',
            boletoUrl: 'https://asaas.test/boletos/123',
            digitableLine: '12345678901234567890123456789012345678901234',
            barcode: '12345678901234567890123456789012345678901234',
            dueDate: input.dueDate
        };
    }
}

describe('AssignSchoolPlan - first invoice due next day', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('issues the first invoice with next-day due date', async () => {
        vi.useFakeTimers();
        const now = new Date('2024-05-05T10:00:00Z');
        vi.setSystemTime(now);

        const schoolRepo = new InMemorySchoolRepository();
        const planRepo = new InMemoryPlanRepository();
        const financeRepo = new InMemoryFinanceRepository();
        const invoiceRepo = new InMemoryInvoiceRepository();
        const paymentProvider = new TestPaymentProvider();

        const address = PostalAddress.create({
            street: 'Rua Exemplo',
            number: '100',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01010-000'
        });
        const school = School.create({
            id: 'school-1',
            name: 'Escola Teste',
            email: 'contato@escola.com',
            phone: '11988887777',
            cnpj: '12.345.678/0001-11',
            addresses: [address],
            ownerName: 'Diretora Teste',
            ownerCpf: '123.456.789-01',
            ownerEmail: 'diretora@escola.com'
        });
        schoolRepo.seed(school);

        const plan = SubscriptionPlan.create({
            id: 'plan-1',
            code: 'BASIC',
            name: 'Plano Básico',
            amountCents: 15000,
            currency: 'BRL'
        });
        planRepo.seed(plan);

        const issueInvoice = new IssueSchoolPlanInvoice(schoolRepo, financeRepo, invoiceRepo, paymentProvider);
        const useCase = new AssignSchoolPlan(schoolRepo, planRepo, financeRepo, issueInvoice);

        const result = await useCase.exec({
            schoolId: school.id,
            planId: plan.id
        });

        expect(paymentProvider.lastBoletoInput).not.toBeNull();
        expect(paymentProvider.lastBoletoInput?.dueDate.toISOString().slice(0, 10)).toBe('2024-05-06');
        expect(result.invoice).toBeDefined();
        expect(result.invoice?.dueDate.toISOString().slice(0, 10)).toBe('2024-05-06');

        const storedFinance = financeRepo.get(school.id);
        expect(storedFinance?.nextDueAt?.toISOString().slice(0, 10)).toBe('2024-06-06');

        const storedInvoice = invoiceRepo.all()[0];
        expect(storedInvoice?.dueDate.toISOString().slice(0, 10)).toBe('2024-05-06');
        expect(storedInvoice?.amountCents).toBe(plan.amountCents);
    });
});
