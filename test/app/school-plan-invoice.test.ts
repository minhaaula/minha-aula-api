import { describe, expect, it, vi, afterEach } from 'vitest';
import { IssueSchoolPlanInvoice } from '../../src/app/use-cases/issue-school-plan-invoice';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { School } from '../../src/domain/entities/school';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { SchoolPlanFinanceRepository } from '../../src/ports/repositories/school-plan-finance.repo';
import { SchoolPlanFinance } from '../../src/domain/entities/school-plan-finance';
import { SubscriptionPlan } from '../../src/domain/entities/subscription-plan';
import { SchoolPlanInvoiceRepository } from '../../src/ports/repositories/school-plan-invoice.repo';
import { SchoolPlanInvoice } from '../../src/domain/entities/school-plan-invoice';
import { PaymentProviderPort, CreateChargeInput, CreateBoletoChargeInput, CreatePixChargeInput } from '../../src/ports/providers/payment-provider.port';

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

class InMemoryFinanceRepository implements SchoolPlanFinanceRepository {
    private readonly items = new Map<string, SchoolPlanFinance>();

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

class InMemoryInvoiceRepository implements SchoolPlanInvoiceRepository {
    private readonly items = new Map<string, SchoolPlanInvoice>();

    async findByFinanceIdAndDueDate(financeId: string, dueDate: Date): Promise<SchoolPlanInvoice | null> {
        const dateKey = dueDate.toISOString().slice(0, 10);
        return (
            Array.from(this.items.values()).find(
                (item) => item.financeId === financeId && item.dueDate.toISOString().slice(0, 10) === dateKey
            ) ?? null
        );
    }

    async save(invoice: SchoolPlanInvoice): Promise<void> {
        this.items.set(invoice.id, invoice);
    }

    seed(invoice: SchoolPlanInvoice) {
        this.items.set(invoice.id, invoice);
    }
}

class TestPaymentProvider implements PaymentProviderPort {
    public readonly boletoCalls: CreateBoletoChargeInput[] = [];
    public readonly pixCalls: CreatePixChargeInput[] = [];

    async authorize(_input: CreateChargeInput): Promise<{ providerRef: string }> {
        throw new Error('Not implemented');
    }

    async capture(): Promise<void> {
        throw new Error('Not implemented');
    }

    async createBoletoCharge(input: CreateBoletoChargeInput) {
        this.boletoCalls.push(input);
        return {
            providerRef: `asaas-boleto-${this.boletoCalls.length}`,
            boletoUrl: 'https://asaas.test/boletos/123',
            digitableLine: '12345678901234567890123456789012345678901234',
            barcode: '12345678901234567890123456789012345678901234',
            dueDate: input.dueDate
        };
    }

    async createPixCharge(input: CreatePixChargeInput) {
        this.pixCalls.push(input);
        return {
            providerRef: `asaas-pix-${this.pixCalls.length}`,
            pixQrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            pixCopiaECola: '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000520400005303986540515.005802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
            invoiceUrl: 'https://asaas.test/pix/123',
            dueDate: input.dueDate
        };
    }
}

function createSchool(): School {
    const address = PostalAddress.create({
        street: 'Rua Principal',
        number: '100',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01010-000'
    });

    return School.create({
        id: 'school-1',
        name: 'Escola de Teste',
        email: 'contato@escolateste.com',
        phone: '11988887777',
        cnpj: '12.345.678/0001-11',
        addresses: [address],
        ownerName: 'Diretor Teste',
        ownerCpf: '123.456.789-09',
        ownerEmail: 'diretor@escolateste.com'
    });
}

function createPlan(): SubscriptionPlan {
    return SubscriptionPlan.create({
        id: 'plan-1',
        code: 'BASIC',
        name: 'Plano Básico',
        amountCents: 15000,
        currency: 'BRL'
    });
}

describe('IssueSchoolPlanInvoice', () => {
    afterEach(() => {
        vi.useRealTimers();
    });
    it('issues a boleto invoice and schedules the next billing date', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const financesRepo = new InMemoryFinanceRepository();
        const invoicesRepo = new InMemoryInvoiceRepository();
        const provider = new TestPaymentProvider();

        const school = createSchool();
        const plan = createPlan();
        const finance = SchoolPlanFinance.create({
            id: 'finance-1',
            schoolId: school.id,
            plan,
            status: 'ACTIVE',
            isPaid: false,
            lastPaymentAt: null,
            nextDueAt: new Date('2024-01-15T00:00:00Z'),
            notes: null,
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-01T00:00:00Z')
        });

        schoolsRepo.seed(school);
        financesRepo.seed(finance);

        const useCase = new IssueSchoolPlanInvoice(schoolsRepo, financesRepo, invoicesRepo, provider);

        const result = await useCase.exec({ schoolId: school.id, dueDate: new Date('2024-01-15T00:00:00Z') });

        expect(result.alreadyExists).toBe(false);
        expect(provider.boletoCalls).toHaveLength(1);
        expect(result.invoice.financeId).toBe(finance.id);
        expect(result.invoice.amountCents).toBe(plan.amountCents);
        expect(result.finance.nextDueAt?.toISOString().slice(0, 10)).toBe('2024-02-15');

        const stored = await invoicesRepo.findByFinanceIdAndDueDate(finance.id, new Date('2024-01-15T00:00:00Z'));
        expect(stored).not.toBeNull();
        expect(stored?.providerRef).toMatch(/asaas-boleto-/);
        expect(stored?.boletoUrl).toBeDefined();
        expect(stored?.pixQrCode).toBeNull();
        expect(stored?.pixCopiaECola).toBeNull();
    });

    it('issues a PIX invoice with same-day due date when generatePix is true', async () => {
        vi.useFakeTimers();
        const today = new Date('2024-01-10T10:00:00Z');
        vi.setSystemTime(today);

        const schoolsRepo = new InMemorySchoolRepository();
        const financesRepo = new InMemoryFinanceRepository();
        const invoicesRepo = new InMemoryInvoiceRepository();
        const provider = new TestPaymentProvider();

        const school = createSchool();
        const plan = createPlan();
        const finance = SchoolPlanFinance.create({
            id: 'finance-1',
            schoolId: school.id,
            plan,
            status: 'ACTIVE',
            isPaid: false,
            lastPaymentAt: null,
            nextDueAt: new Date('2024-01-15T00:00:00Z'),
            notes: null,
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-01T00:00:00Z')
        });

        schoolsRepo.seed(school);
        financesRepo.seed(finance);

        const useCase = new IssueSchoolPlanInvoice(schoolsRepo, financesRepo, invoicesRepo, provider);

        const result = await useCase.exec({ 
            schoolId: school.id, 
            generatePix: true 
        });

        expect(result.alreadyExists).toBe(false);
        expect(provider.pixCalls).toHaveLength(1);
        expect(provider.boletoCalls).toHaveLength(0);
        expect(result.invoice.financeId).toBe(finance.id);
        expect(result.invoice.amountCents).toBe(plan.amountCents);
        
        // Verifica que a data de vencimento é o mesmo dia (hoje)
        const todayStr = today.toISOString().slice(0, 10);
        expect(result.invoice.dueDate.toISOString().slice(0, 10)).toBe(todayStr);
        expect(provider.pixCalls[0].dueDate.toISOString().slice(0, 10)).toBe(todayStr);
        
        // Verifica que os campos PIX foram preenchidos
        expect(result.invoice.pixQrCode).toBeDefined();
        expect(result.invoice.pixCopiaECola).toBeDefined();
        expect(result.invoice.providerRef).toMatch(/asaas-pix-/);
        expect(result.invoice.boletoUrl).toBeNull();
        expect(result.invoice.digitableLine).toBeNull();

        const stored = await invoicesRepo.findByFinanceIdAndDueDate(finance.id, today);
        expect(stored).not.toBeNull();
        expect(stored?.pixQrCode).toBeDefined();
        expect(stored?.pixCopiaECola).toBeDefined();
        expect(stored?.boletoUrl).toBeNull();
    });

    it('skips provider call when invoice already exists for due date', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const financesRepo = new InMemoryFinanceRepository();
        const invoicesRepo = new InMemoryInvoiceRepository();
        const provider = new TestPaymentProvider();

        const school = createSchool();
        const plan = createPlan();
        const finance = SchoolPlanFinance.create({
            id: 'finance-2',
            schoolId: school.id,
            plan,
            status: 'ACTIVE',
            isPaid: false,
            lastPaymentAt: null,
            nextDueAt: new Date('2024-03-01T00:00:00Z'),
            notes: null,
            createdAt: new Date('2024-02-01T00:00:00Z'),
            updatedAt: new Date('2024-02-01T00:00:00Z')
        });

        const existingInvoice = SchoolPlanInvoice.create({
            id: 'invoice-1',
            financeId: finance.id,
            schoolId: school.id,
            planId: plan.id,
            amountCents: plan.amountCents,
            currency: plan.currency,
            dueDate: new Date('2024-03-01T00:00:00Z'),
            description: 'Assinatura Plano Básico',
            providerRef: 'asaas-existing',
            boletoUrl: 'https://asaas.test/boletos/existing',
            digitableLine: '00011122233344455566677788899900011122233344',
            metadata: { financeId: finance.id }
        });

        schoolsRepo.seed(school);
        financesRepo.seed(finance);
        invoicesRepo.seed(existingInvoice);

        const useCase = new IssueSchoolPlanInvoice(schoolsRepo, financesRepo, invoicesRepo, provider);

        const result = await useCase.exec({ schoolId: school.id, dueDate: new Date('2024-03-01T00:00:00Z') });

        expect(result.alreadyExists).toBe(true);
        expect(provider.boletoCalls).toHaveLength(0);
        expect(result.invoice.id).toBe(existingInvoice.id);
        expect(result.finance.nextDueAt?.toISOString().slice(0, 10)).toBe('2024-03-01');
    });
});
