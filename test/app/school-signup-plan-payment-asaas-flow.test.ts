/**
 * Teste do fluxo completo: cadastro da escola → seleção de plano → pagamento do plano
 * → job ensure_school_asaas_account (conta Asaas + onboarding).
 *
 * Fluxo coberto:
 * 1. CreateSchool – cria a escola
 * 2. AssignSchoolPlan – associa plano e emite primeira invoice (PIX)
 * 3. HandleAsaasPaymentWebhook – pagamento confirmado, marca invoice PAID e enfileira job
 * 4. EnsureSchoolAsaasAccount – cria subconta Asaas e retorna onboardingPending
 * 5. Simula worker salvando onboardingUrl na escola
 */

import { describe, expect, it, vi } from 'vitest';
import { CreateSchool } from '../../src/app/use-cases/create-school';
import { AssignSchoolPlan } from '../../src/app/use-cases/assign-school-plan';
import { IssueSchoolPlanInvoice } from '../../src/app/use-cases/issue-school-plan-invoice';
import { HandleAsaasPaymentWebhook } from '../../src/app/use-cases/handle-asaas-payment-webhook';
import { EnsureSchoolAsaasAccount } from '../../src/app/use-cases/ensure-school-asaas-account';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { SchoolPlanFinanceRepository } from '../../src/ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceRepository } from '../../src/ports/repositories/school-plan-invoice.repo';
import { SubscriptionPlanRepository } from '../../src/ports/repositories/subscription-plan.repo';
import { OutboxRepository } from '../../src/ports/repositories/outbox.repo';
import { School } from '../../src/domain/entities/school';
import { SchoolPlanInvoice } from '../../src/domain/entities/school-plan-invoice';
import { SchoolPlanFinance } from '../../src/domain/entities/school-plan-finance';
import { SubscriptionPlan } from '../../src/domain/entities/subscription-plan';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { PasswordHasherPort } from '../../src/ports/providers/password-hasher.port';
import { PaymentProviderPort } from '../../src/ports/providers/payment-provider.port';
import type { CreatePixChargeInput } from '../../src/ports/providers/payment-provider.port';
import type { AsaasProviderPort, CreateAsaasSubAccountInput, AsaasSubAccount } from '../../src/ports/providers/asaas-port';

// --- In-Memory Repositories ---

class InMemorySchoolRepo implements SchoolRepository {
    private readonly items = new Map<string, School>();

    async findById(id: string): Promise<School | null> {
        return this.items.get(id) ?? null;
    }

    async findByEmail(email: string): Promise<School | null> {
        const n = email.trim().toLowerCase();
        return Array.from(this.items.values()).find((s) => s.email === n) ?? null;
    }

    async findByCnpj(cnpj: string): Promise<School | null> {
        const digits = cnpj.replace(/\D/g, '');
        if (digits.length !== 14) return null;
        return Array.from(this.items.values()).find((s) => s.cnpj === digits) ?? null;
    }

    async findAll(): Promise<School[]> {
        return Array.from(this.items.values());
    }

    async save(school: School): Promise<void> {
        this.items.set(school.id, school);
    }
}

class InMemoryPlanRepo implements SubscriptionPlanRepository {
    private readonly items = new Map<string, SubscriptionPlan>();

    async findById(id: string): Promise<SubscriptionPlan | null> {
        return this.items.get(id) ?? null;
    }

    async findActive(): Promise<SubscriptionPlan[]> {
        return Array.from(this.items.values()).filter((p) => p.isActive);
    }

    async findAll(): Promise<SubscriptionPlan[]> {
        return Array.from(this.items.values());
    }

    async findByCode(_code: string): Promise<SubscriptionPlan | null> {
        return null;
    }

    async save(plan: SubscriptionPlan): Promise<void> {
        this.items.set(plan.id, plan);
    }
}

class InMemoryFinanceRepo implements SchoolPlanFinanceRepository {
    private readonly items = new Map<string, SchoolPlanFinance>();

    async findById(id: string): Promise<SchoolPlanFinance | null> {
        return this.items.get(id) ?? null;
    }

    async findActiveBySchoolId(schoolId: string): Promise<SchoolPlanFinance | null> {
        return Array.from(this.items.values()).find((f) => f.schoolId === schoolId) ?? null;
    }

    async save(finance: SchoolPlanFinance): Promise<void> {
        this.items.set(finance.id, finance);
    }
}

class InMemoryInvoiceRepo implements SchoolPlanInvoiceRepository {
    private readonly items = new Map<string, SchoolPlanInvoice>();

    async findById(id: string): Promise<SchoolPlanInvoice | null> {
        return this.items.get(id) ?? null;
    }

    async findByFinanceIdAndDueDate(financeId: string, dueDate: Date): Promise<SchoolPlanInvoice | null> {
        const key = dueDate.toISOString().slice(0, 10);
        return (
            Array.from(this.items.values()).find(
                (i) => i.financeId === financeId && i.dueDate.toISOString().slice(0, 10) === key
            ) ?? null
        );
    }

    async findByProviderRef(providerRef: string): Promise<SchoolPlanInvoice | null> {
        return Array.from(this.items.values()).find((i) => i.providerRef === providerRef) ?? null;
    }

    async findByExternalReference(_ext: string): Promise<SchoolPlanInvoice | null> {
        return null;
    }

    async save(invoice: SchoolPlanInvoice): Promise<void> {
        this.items.set(invoice.id, invoice);
    }

    async hasSchoolAnyPaidInvoice(_schoolId: string): Promise<boolean> {
        return Array.from(this.items.values()).some((i) => i.status === 'PAID');
    }

    async getSchoolIdsWithPaidInvoice(schoolIds: string[]): Promise<Set<string>> {
        const set = new Set<string>();
        for (const i of this.items.values()) {
            if (i.status === 'PAID' && schoolIds.includes(i.schoolId)) set.add(i.schoolId);
        }
        return set;
    }

    async findByFinanceId(_financeId: string): Promise<SchoolPlanInvoice[]> {
        return [];
    }

    async findPaidWithoutReceiptUrl(_limit: number): Promise<SchoolPlanInvoice[]> {
        return [];
    }

    async findIssuedWithProviderRef(_limit: number, _daysAgo?: number): Promise<SchoolPlanInvoice[]> {
        return [];
    }
}

/** Outbox que guarda eventos enfileirados para o teste obter invoiceId do job. */
class CapturingOutbox implements OutboxRepository {
    public readonly events: Array<{ type: string; payload: unknown; aggregateId: string }> = [];

    async enqueue(event: { type: string; payload: unknown; aggregateId: string }): Promise<void> {
        this.events.push(event);
    }
}

class FakePasswordHasher implements PasswordHasherPort {
    async hash(plain: string): Promise<string> {
        return `hashed:${plain}`;
    }
}

class TestPaymentProvider implements PaymentProviderPort {
    public lastPixInput: CreatePixChargeInput | null = null;
    public providerRef = 'asaas-pix-test-1';

    async authorize(): Promise<{ providerRef: string }> {
        throw new Error('Not used');
    }

    async capture(): Promise<void> {
        throw new Error('Not used');
    }

    async createPixCharge(input: CreatePixChargeInput) {
        this.lastPixInput = input;
        return {
            providerRef: this.providerRef,
            pixQrCode: 'data:image/png;base64,test',
            pixCopiaECola: '00020126test',
            invoiceUrl: 'https://asaas.test/pix/test',
            dueDate: input.dueDate
        };
    }
}

/** Provider Asaas fake: createSubAccount retorna apiKey; getOnboardingUrl retorna URL. */
class FakeAsaasProvider implements AsaasProviderPort {
    public readonly createSubAccountCalls: CreateAsaasSubAccountInput[] = [];
    public readonly onboardingUrl = 'https://sandbox.asaas.com/onboarding/test-token';

    async createSubAccount(input: CreateAsaasSubAccountInput): Promise<AsaasSubAccount> {
        this.createSubAccountCalls.push(input);
        return {
            id: 'sub-asaas-123',
            name: input.name,
            email: input.email,
            status: 'PENDING',
            externalReference: input.externalReference ?? null,
            apiKey: 'sk_test_onboarding_key',
            walletId: 'wallet-1'
        };
    }

    async getOnboardingUrl(accountApiKey: string): Promise<string | null> {
        return accountApiKey ? this.onboardingUrl : null;
    }
}

describe('Fluxo: cadastro escola → seleção plano → pagamento → Asaas e onboarding', () => {
    it('cadastra escola, associa plano com PIX, simula pagamento, cria conta Asaas e gera onboarding', async () => {
        vi.useFakeTimers();
        const now = new Date('2024-06-01T12:00:00Z');
        vi.setSystemTime(now);

        const schoolRepo = new InMemorySchoolRepo();
        const planRepo = new InMemoryPlanRepo();
        const financeRepo = new InMemoryFinanceRepo();
        const invoiceRepo = new InMemoryInvoiceRepo();
        const capturingOutbox = new CapturingOutbox();
        const paymentProvider = new TestPaymentProvider();
        const asaasProvider = new FakeAsaasProvider();

        const plan = SubscriptionPlan.create({
            id: 'plan-1',
            code: 'BASIC',
            name: 'Plano Básico',
            amountCents: 9900,
            currency: 'BRL',
            billingCycle: 'MONTHLY'
        });
        await planRepo.save(plan);

        // 1) Cadastro da escola
        const createSchool = new CreateSchool(schoolRepo, new FakePasswordHasher());
        const schoolOutput = await createSchool.exec({
            name: 'Escola Fluxo Teste',
            email: 'fluxo@escola.com',
            phone: '11987654321',
            cnpj: '11222333000181',
            incomeValue: 5000,
            addresses: [
                {
                    street: 'Rua das Flores',
                    number: '100',
                    complement: null,
                    district: 'Centro',
                    city: 'São Paulo',
                    state: 'SP',
                    zipCode: '01310100'
                }
            ]
        });

        expect(schoolOutput.id).toBeDefined();
        expect(schoolOutput.name).toBe('Escola Fluxo Teste');
        const school = await schoolRepo.findById(schoolOutput.id);
        expect(school).not.toBeNull();
        expect(school?.accountId).toBeNull();

        // 2) Seleção de plano (emite primeira invoice com PIX)
        const issueInvoice = new IssueSchoolPlanInvoice(
            schoolRepo,
            financeRepo,
            invoiceRepo,
            paymentProvider
        );
        const assignPlan = new AssignSchoolPlan(schoolRepo, planRepo, financeRepo, issueInvoice);
        const assignResult = await assignPlan.exec({
            schoolId: schoolOutput.id,
            planId: plan.id
        });

        expect(assignResult.invoice).toBeDefined();
        expect(assignResult.invoice?.providerRef).toBe(paymentProvider.providerRef);
        const invoiceId = assignResult.invoice!.id;
        const providerRef = assignResult.invoice!.providerRef!;

        // Invoice ainda não está paga
        let invoice = await invoiceRepo.findById(invoiceId);
        expect(invoice?.status).toBe('ISSUED');

        // 3) Simula webhook de pagamento confirmado (marca PAID e enfileira job)
        const handleWebhook = new HandleAsaasPaymentWebhook(
            invoiceRepo,
            financeRepo,
            schoolRepo,
            undefined,
            capturingOutbox
        );
        const webhookResult = await handleWebhook.exec({
            event: 'PAYMENT_CONFIRMED',
            payment: {
                id: providerRef,
                status: 'RECEIVED',
                paymentDate: '2024-06-01T14:00:00Z'
            }
        });

        expect(webhookResult.handled).toBe(true);
        invoice = await invoiceRepo.findById(invoiceId);
        expect(invoice?.status).toBe('PAID');

        // Job foi enfileirado
        const ensureJob = capturingOutbox.events.find((e) => e.type === 'ensure_school_asaas_account');
        expect(ensureJob).toBeDefined();
        expect((ensureJob!.payload as { invoiceId: string }).invoiceId).toBe(invoiceId);

        // 4) Simula worker: EnsureSchoolAsaasAccount (cria conta Asaas)
        const ensureAsaas = new EnsureSchoolAsaasAccount(invoiceRepo, schoolRepo, asaasProvider);
        const ensureResult = await ensureAsaas.exec({
            invoiceId: (ensureJob!.payload as { invoiceId: string }).invoiceId
        });

        expect(ensureResult.done).toBe(true);
        expect(ensureResult.onboardingPending).toBeDefined();
        expect(ensureResult.onboardingPending!.schoolId).toBe(schoolOutput.id);
        expect(ensureResult.onboardingPending!.accountApiKey).toBe('sk_test_onboarding_key');

        // Escola atualizada com accountId / accountApiKey / walletId
        const schoolAfterAsaas = await schoolRepo.findById(schoolOutput.id);
        expect(schoolAfterAsaas?.accountId).toBe('sub-asaas-123');
        expect(schoolAfterAsaas?.accountApiKey).toBe('sk_test_onboarding_key');
        expect(schoolAfterAsaas?.walletId).toBe('wallet-1');

        // Asaas createSubAccount foi chamado com dados da escola
        expect(asaasProvider.createSubAccountCalls).toHaveLength(1);
        const asaasInput = asaasProvider.createSubAccountCalls[0];
        expect(asaasInput.name).toBe('Escola Fluxo Teste');
        expect(asaasInput.email).toBe('fluxo@escola.com');
        expect(asaasInput.externalReference).toBe(schoolOutput.id);
        expect(asaasInput.address).toBe('Rua das Flores');
        expect(asaasInput.addressNumber).toBe('100');
        expect(asaasInput.postalCode).toBe('01310100');

        // 5) Simula worker: busca onboarding URL e salva na escola
        const onboardingUrl = await asaasProvider.getOnboardingUrl(ensureResult.onboardingPending!.accountApiKey);
        expect(onboardingUrl).toBe(asaasProvider.onboardingUrl);
        if (onboardingUrl && schoolAfterAsaas) {
            await schoolRepo.save(schoolAfterAsaas.withOnboardingUrl(onboardingUrl));
        }

        const schoolFinal = await schoolRepo.findById(schoolOutput.id);
        expect(schoolFinal?.onboardingUrl).toBe(asaasProvider.onboardingUrl);

        vi.useRealTimers();
    });
});
