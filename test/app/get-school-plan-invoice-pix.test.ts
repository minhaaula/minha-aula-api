import { describe, expect, it } from 'vitest';
import { GetSchoolPlanInvoicePix } from '../../src/app/use-cases/get-school-plan-invoice-pix';
import { SchoolPlanInvoiceRepository } from '../../src/ports/repositories/school-plan-invoice.repo';
import { SchoolPlanInvoice } from '../../src/domain/entities/school-plan-invoice';
import type { AsaasProviderPort } from '../../src/ports/providers/asaas-port';

class InMemoryInvoiceRepo implements SchoolPlanInvoiceRepository {
    private readonly items = new Map<string, SchoolPlanInvoice>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async hasSchoolAnyPaidInvoice() { return false; }
    async getSchoolIdsWithPaidInvoice() { return new Set<string>(); }
    async findByFinanceIdAndDueDate() { return null; }
    async findByProviderRef() { return null; }
    async findByExternalReference() { return null; }
    async findByFinanceId() { return []; }
    async findPaidWithoutReceiptUrl() { return []; }
    async findIssuedWithProviderRef() { return []; }
    async findIssuedByDueDateRange() { return []; }
    async save(invoice: SchoolPlanInvoice) { this.items.set(invoice.id, invoice); }
    seed(invoice: SchoolPlanInvoice) { this.items.set(invoice.id, invoice); }
}

class FakeAsaas implements AsaasProviderPort {
    async createBoletoCharge(): Promise<any> { throw new Error('not used'); }
    async authorizeCharge(): Promise<any> { throw new Error('not used'); }
    async captureCharge(): Promise<void> { throw new Error('not used'); }
    async getPixQrCode(paymentId: string) {
        return { encodedImage: `qr:${paymentId}`, payload: `pix:${paymentId}` };
    }
}

function makeInvoice(params: Partial<{ pixQrCode: string | null; pixCopiaECola: string | null; providerRef: string | null }> = {}) {
    return SchoolPlanInvoice.create({
        id: '11111111-1111-1111-1111-111111111111',
        financeId: '22222222-2222-2222-2222-222222222222',
        schoolId: '33333333-3333-3333-3333-333333333333',
        planId: '44444444-4444-4444-4444-444444444444',
        amountCents: 9900,
        currency: 'BRL',
        dueDate: new Date('2026-05-10T00:00:00.000Z'),
        providerRef: params.providerRef ?? 'pay_abc',
        pixQrCode: params.pixQrCode ?? null,
        pixCopiaECola: params.pixCopiaECola ?? null,
        metadata: {}
    });
}

describe('GetSchoolPlanInvoicePix', () => {
    it('retorna PIX existente sem chamar Asaas', async () => {
        const repo = new InMemoryInvoiceRepo();
        const invoice = makeInvoice({ pixQrCode: 'qr-old', pixCopiaECola: 'pix-old' });
        repo.seed(invoice);

        const useCase = new GetSchoolPlanInvoicePix(repo, new FakeAsaas());
        const result = await useCase.exec({
            invoiceId: invoice.id,
            schoolId: invoice.schoolId
        });

        expect(result.pixQrCode).toBe('qr-old');
        expect(result.pixCopiaECola).toBe('pix-old');
    });

    it('busca PIX no Asaas quando não existe e persiste na invoice', async () => {
        const repo = new InMemoryInvoiceRepo();
        const invoice = makeInvoice({ pixQrCode: null, pixCopiaECola: null, providerRef: 'pay_xyz' });
        repo.seed(invoice);

        const useCase = new GetSchoolPlanInvoicePix(repo, new FakeAsaas());
        const result = await useCase.exec({
            invoiceId: invoice.id,
            schoolId: invoice.schoolId
        });

        expect(result.pixQrCode).toBe('qr:pay_xyz');
        expect(result.pixCopiaECola).toBe('pix:pay_xyz');

        const stored = await repo.findById(invoice.id);
        expect(stored?.pixQrCode).toBe('qr:pay_xyz');
        expect(stored?.pixCopiaECola).toBe('pix:pay_xyz');
    });
});

