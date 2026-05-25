import { describe, expect, it, vi, afterEach } from 'vitest';
import { AssignSchoolPlan } from '../../src/app/use-cases/schools/assign-school-plan';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { SubscriptionPlanRepository } from '../../src/ports/repositories/subscription-plan.repo';
import { SchoolPlanFinanceRepository } from '../../src/ports/repositories/school-plan-finance.repo';
import { School } from '../../src/domain/entities/school';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { SubscriptionPlan } from '../../src/domain/entities/subscription-plan';
import { SchoolPlanFinance } from '../../src/domain/entities/school-plan-finance';
import { IssueSchoolPlanInvoice } from '../../src/app/use-cases/schools/issue-school-plan-invoice';
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

class InMemoryPlanRepository implements SubscriptionPlanRepository {
    private readonly items = new Map<string, SubscriptionPlan>();

    async findActive(): Promise<SubscriptionPlan[]> {
        return Array.from(this.items.values()).filter((p) => p.isActive);
    }

    async findAll(): Promise<SubscriptionPlan[]> {
        return Array.from(this.items.values());
    }

    async findById(id: string): Promise<SubscriptionPlan | null> {
        return this.items.get(id) ?? null;
    }

    async findByCode(code: string): Promise<SubscriptionPlan | null> {
        const normalized = code.trim().toUpperCase();
        return Array.from(this.items.values()).find((p) => p.code === normalized) ?? null;
    }

    async save(plan: SubscriptionPlan): Promise<void> {
        this.items.set(plan.id, plan);
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

    async findById(): Promise<SchoolPlanInvoice | null> {
        return null;
    }

    async hasSchoolAnyPaidInvoice(): Promise<boolean> {
        return false;
    }

    async getSchoolIdsWithPaidInvoice(): Promise<Set<string>> {
        return new Set();
    }

    async findByProviderRef(): Promise<SchoolPlanInvoice | null> {
        return null;
    }

    async findByExternalReference(): Promise<SchoolPlanInvoice | null> {
        return null;
    }

    async findByFinanceId(financeId: string): Promise<SchoolPlanInvoice[]> {
        return Array.from(this.items.values()).filter((item) => item.financeId === financeId);
    }

    async countByFinanceIdAndDiscountCouponId(financeId: string, discountCouponId: string): Promise<number> {
        return Array.from(this.items.values()).filter(
            (item) => item.financeId === financeId && item.discountCouponId === discountCouponId
        ).length;
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

    all() {
        return Array.from(this.items.values());
    }
}

class TestPaymentProvider implements PaymentProviderPort {
    public lastBoletoInput: CreateBoletoChargeInput | null = null;
    public lastPixInput: CreatePixChargeInput | null = null;

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

    async createPixCharge(input: CreatePixChargeInput) {
        this.lastPixInput = input;
        return {
            providerRef: 'asaas-pix-1',
            pixQrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            pixCopiaECola: '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000520400005303986540515.005802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
            invoiceUrl: 'https://asaas.test/pix/123',
            dueDate: input.dueDate
        };
    }
}

describe('AssignSchoolPlan', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('issues PIX invoice with same-day due date when plan is selected', async () => {
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

        // Verifica que foi gerado PIX, não boleto
        expect(paymentProvider.lastPixInput).not.toBeNull();
        expect(paymentProvider.lastBoletoInput).toBeNull();
        
        // Verifica que a data de vencimento é o mesmo dia (hoje)
        expect(paymentProvider.lastPixInput?.dueDate.toISOString().slice(0, 10)).toBe('2024-05-05');
        
        // Verifica que a invoice foi retornada com dados do PIX
        expect(result.invoice).toBeDefined();
        expect(result.invoice?.dueDate.toISOString().slice(0, 10)).toBe('2024-05-05');
        expect(result.invoice?.pixQrCode).toBeDefined();
        expect(result.invoice?.pixCopiaECola).toBeDefined();
        expect(result.invoice?.providerRef).toBe('asaas-pix-1');

        // Verifica que a invoice foi salva com dados do PIX
        const storedInvoice = invoiceRepo.all()[0];
        expect(storedInvoice?.dueDate.toISOString().slice(0, 10)).toBe('2024-05-05');
        expect(storedInvoice?.amountCents).toBe(plan.amountCents);
        expect(storedInvoice?.pixQrCode).toBeDefined();
        expect(storedInvoice?.pixCopiaECola).toBeDefined();
        expect(storedInvoice?.boletoUrl).toBeNull();
        expect(storedInvoice?.digitableLine).toBeNull();
    });
});
