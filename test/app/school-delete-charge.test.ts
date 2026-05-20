import { describe, expect, it, vi } from 'vitest';
import { SchoolDeleteCharge } from '../../src/app/use-cases/school-delete-charge';
import { SchoolFinancialCharge } from '../../src/domain/entities/school-financial-charge';
import { AppError } from '../../src/shared/errors';

function makeCharge(schoolId: string, status: 'OPEN' | 'PAID' = 'OPEN'): SchoolFinancialCharge {
    return SchoolFinancialCharge.restore({
        id: 'charge-1',
        schoolId,
        ownerUserId: 'owner-1',
        studentUserId: 'student-1',
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
        dueDate: new Date('2026-02-10'),
        status,
        asaasPaymentId: null,
        asaasInvoiceUrl: null,
        asaasPayload: null,
        paidAt: status === 'PAID' ? new Date() : null,
        paymentMethod: null,
        paidObservation: null,
        cancelledAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01')
    });
}

describe('SchoolDeleteCharge', () => {
    it('cancela cobrança em aberto da escola', async () => {
        const save = vi.fn(async () => undefined);
        const useCase = new SchoolDeleteCharge(
            { findById: vi.fn(async () => makeCharge('school-1')), save } as never,
            { findById: vi.fn() } as never
        );

        const result = await useCase.exec({ schoolId: 'school-1', chargeId: 'charge-1' });
        expect(result.status).toBe('CANCELLED');
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('rejeita cobrança de outra escola', async () => {
        const useCase = new SchoolDeleteCharge(
            { findById: vi.fn(async () => makeCharge('school-other')), save: vi.fn() } as never,
            { findById: vi.fn() } as never
        );

        await expect(useCase.exec({ schoolId: 'school-1', chargeId: 'charge-1' })).rejects.toBeInstanceOf(AppError);
    });

    it('rejeita exclusão de cobrança paga', async () => {
        const useCase = new SchoolDeleteCharge(
            { findById: vi.fn(async () => makeCharge('school-1', 'PAID')), save: vi.fn() } as never,
            { findById: vi.fn() } as never
        );

        await expect(useCase.exec({ schoolId: 'school-1', chargeId: 'charge-1' })).rejects.toBeInstanceOf(AppError);
    });
});
