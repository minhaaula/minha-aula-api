import { describe, expect, it } from 'vitest';
import { AdminMarkChargePaid } from '../../src/app/use-cases/admin-mark-charge-paid';
import type { SchoolFinancialChargeRepository } from '../../src/ports/repositories/school-financial-charge.repo';
import type { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { SchoolFinancialCharge } from '../../src/domain/entities/school-financial-charge';

describe('AdminMarkChargePaid', () => {
    it('persiste paymentMethod MANUAL ao dar baixa manual (para listagem retornar type MANUAL)', async () => {
        const charge = SchoolFinancialCharge.restore({
            id: 'ce7b5773-f745-4b96-b165-24d44b44c694',
            schoolId: 'school-1',
            ownerUserId: 'user-1',
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
            dueDate: new Date('2026-03-10'),
            status: 'OPEN',
            asaasPaymentId: 'pay_asaas_123',
            asaasInvoiceUrl: 'https://example.com/invoice',
            asaasPayload: { billingType: 'PIX', pixQrCode: 'qrcode' },
            paidAt: null,
            paidObservation: null,
            cancelledAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        let savedCharge: SchoolFinancialCharge | null = null;
        const chargeRepo: SchoolFinancialChargeRepository = {
            findById: async (id) => (id === charge.id ? charge : null),
            save: async (c) => {
                savedCharge = c;
            }
        } as any;

        const schoolsRepo = { findById: async () => null } as unknown as SchoolRepository;

        const useCase = new AdminMarkChargePaid(chargeRepo, schoolsRepo, null);
        await useCase.exec({ chargeId: charge.id });

        expect(savedCharge).not.toBeNull();
        expect(savedCharge!.status).toBe('PAID');
        expect(savedCharge!.paymentMethod).toBe('MANUAL');
    });
});
