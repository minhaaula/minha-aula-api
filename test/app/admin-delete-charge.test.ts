import { describe, expect, it, vi } from 'vitest';
import { AdminDeleteCharge } from '../../src/app/use-cases/admin-delete-charge';
import { SchoolFinancialCharge } from '../../src/domain/entities/school-financial-charge';
import { AppError } from '../../src/shared/errors';

function makeCharge(status: 'OPEN' | 'PAID' | 'CANCELLED' = 'OPEN'): SchoolFinancialCharge {
    return SchoolFinancialCharge.restore({
        id: 'charge-1',
        schoolId: 'school-1',
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
        asaasPaymentId: 'pay_asaas_1',
        asaasInvoiceUrl: null,
        asaasPayload: null,
        paidAt: status === 'PAID' ? new Date() : null,
        paymentMethod: null,
        paidObservation: null,
        cancelledAt: status === 'CANCELLED' ? new Date() : null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01')
    });
}

describe('AdminDeleteCharge', () => {
    it('cancela cobrança em aberto e tenta excluir no Asaas', async () => {
        const charge = makeCharge('OPEN');
        const save = vi.fn(async () => undefined);
        const deletePayment = vi.fn(async () => ({ deleted: true, id: 'pay_asaas_1' }));

        const useCase = new AdminDeleteCharge(
            { findById: vi.fn(async () => charge), save } as never,
            { findById: vi.fn(async () => null) } as never,
            { deletePayment } as never
        );

        const result = await useCase.exec({ chargeId: 'charge-1' });

        expect(result.status).toBe('CANCELLED');
        expect(result.alreadyCancelled).toBe(false);
        expect(deletePayment).toHaveBeenCalledWith('pay_asaas_1');
        expect(save).toHaveBeenCalledTimes(1);
        const saved = save.mock.calls[0][0] as SchoolFinancialCharge;
        expect(saved.status).toBe('CANCELLED');
    });

    it('rejeita exclusão de cobrança paga', async () => {
        const useCase = new AdminDeleteCharge(
            { findById: vi.fn(async () => makeCharge('PAID')), save: vi.fn() } as never,
            { findById: vi.fn() } as never
        );

        await expect(useCase.exec({ chargeId: 'charge-1' })).rejects.toMatchObject({
            code: 'CHARGE_ALREADY_PAID'
        });
    });

    it('é idempotente quando já cancelada', async () => {
        const charge = makeCharge('CANCELLED');
        const useCase = new AdminDeleteCharge(
            { findById: vi.fn(async () => charge), save: vi.fn() } as never,
            { findById: vi.fn() } as never
        );

        const result = await useCase.exec({ chargeId: 'charge-1' });
        expect(result.alreadyCancelled).toBe(true);
    });
});
