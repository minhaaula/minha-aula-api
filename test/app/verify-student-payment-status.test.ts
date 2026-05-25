import { describe, expect, it } from 'vitest';
import { VerifyStudentPaymentStatus } from '../../src/app/use-cases/students/verify-student-payment-status';
import { SchoolFinancialCharge } from '../../src/domain/entities/school-financial-charge';
import { School } from '../../src/domain/entities/school';
import { Email } from '../../src/domain/value-objects/email';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { SchoolFinancialChargeRepository } from '../../src/ports/repositories/school-financial-charge.repo';
import type { PaymentProviderPort } from '../../src/ports/providers/payment-provider.port';
import type { AsaasProviderPort } from '../../src/ports/providers/asaas-port';
import { AppError, ErrorCode } from '../../src/shared/errors';

class InMemoryCharges implements SchoolFinancialChargeRepository {
    constructor(private readonly map: Map<string, SchoolFinancialCharge>) {}
    async findById(id: string) {
        return this.map.get(id) ?? null;
    }
    async save(charge: SchoolFinancialCharge) {
        this.map.set(charge.id, charge);
    }
}

class InMemorySchools implements SchoolRepository {
    constructor(private readonly school: School | null) {}
    async findById() {
        return this.school;
    }
    async findByEmail() {
        return null;
    }
    async findByCnpj() {
        return null;
    }
    async findByOwnerUserId() {
        return null;
    }
    async findByOwnerEmail() {
        return null;
    }
    async findByAccountId() {
        return null;
    }
    async findAll() {
        return [];
    }
    async save() {}
}

function makeCharge(overrides: Partial<{
    id: string;
    ownerUserId: string;
    status: 'OPEN' | 'PAID';
    asaasPaymentId: string | null;
}> = {}) {
    return SchoolFinancialCharge.restore({
        id: overrides.id ?? 'charge-1',
        schoolId: 'school-1',
        ownerUserId: overrides.ownerUserId ?? 'user-1',
        studentUserId: 'user-1',
        dependentId: null,
        courseId: 'course-1',
        courseClassId: 'class-1',
        chargeType: 'TUITION',
        description: 'Mensalidade',
        amountCents: 10000,
        discountCents: null,
        discountReason: null,
        netAmountCents: 10000,
        providerNetAmountCents: null,
        dueDate: new Date('2026-06-01'),
        status: overrides.status ?? 'OPEN',
        asaasPaymentId: overrides.asaasPaymentId ?? 'pay-asaas-1',
        asaasInvoiceUrl: null,
        asaasPayload: null,
        paidAt: overrides.status === 'PAID' ? new Date('2026-05-20') : null,
        paymentMethod: overrides.status === 'PAID' ? 'PIX' : null,
        paidObservation: null,
        cancelledAt: null,
        createdAt: new Date('2026-05-01'),
        updatedAt: new Date('2026-05-01')
    });
}

function makeSchool() {
    return School.create({
        id: 'school-1',
        name: 'Escola',
        email: 'e@school.com',
        phone: '11999999999',
        accountId: 'acc-1',
        accountApiKey: 'sub-key'
    });
}

describe('VerifyStudentPaymentStatus', () => {
    it('returns current status without sync when already paid', async () => {
        const charge = makeCharge({ status: 'PAID' });
        const useCase = new VerifyStudentPaymentStatus(
            new InMemoryCharges(new Map([[charge.id, charge]])),
            new InMemorySchools(makeSchool()),
            {} as PaymentProviderPort
        );

        const result = await useCase.exec({ paymentId: 'charge-1', userId: 'user-1' });

        expect(result.status).toBe('PAID');
        expect(result.syncedFromProvider).toBe(false);
    });

    it('syncs from Asaas when payment is confirmed', async () => {
        const charge = makeCharge({ status: 'OPEN', asaasPaymentId: 'pay-asaas-1' });
        const charges = new InMemoryCharges(new Map([[charge.id, charge]]));
        const provider: PaymentProviderPort & Partial<AsaasProviderPort> = {
            getPayment: async () => ({
                id: 'pay-asaas-1',
                status: 'CONFIRMED',
                confirmedDate: '2026-05-20T12:00:00Z'
            })
        };

        const useCase = new VerifyStudentPaymentStatus(
            charges,
            new InMemorySchools(null),
            provider
        );

        const result = await useCase.exec({ paymentId: 'charge-1', userId: 'user-1' });

        expect(result.status).toBe('PAID');
        expect(result.syncedFromProvider).toBe(true);
        const stored = await charges.findById('charge-1');
        expect(stored?.status).toBe('PAID');
    });

    it('rejects payment from another owner', async () => {
        const charge = makeCharge({ ownerUserId: 'user-1' });
        const useCase = new VerifyStudentPaymentStatus(
            new InMemoryCharges(new Map([[charge.id, charge]])),
            new InMemorySchools(null),
            {} as PaymentProviderPort
        );

        await expect(
            useCase.exec({ paymentId: 'charge-1', userId: 'other-user' })
        ).rejects.toMatchObject({ code: ErrorCode.NOT_ALLOWED });
    });

    it('returns not found for missing charge', async () => {
        const useCase = new VerifyStudentPaymentStatus(
            new InMemoryCharges(new Map()),
            new InMemorySchools(null),
            {} as PaymentProviderPort
        );

        await expect(
            useCase.exec({ paymentId: 'missing', userId: 'user-1' })
        ).rejects.toBeInstanceOf(AppError);
    });
});
