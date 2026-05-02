import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { presentSchoolPlanInvoice, type SchoolPlanInvoiceView } from '../presenters/school-plan-invoice.presenter';

export type GetSchoolPlanInvoicePixInput = {
    invoiceId: string;
    schoolId: string;
};

export type GetSchoolPlanInvoicePixOutput = {
    invoice: SchoolPlanInvoiceView;
    pixQrCode: string | null;
    pixCopiaECola: string | null;
};

export class GetSchoolPlanInvoicePix {
    constructor(
        private readonly invoices: SchoolPlanInvoiceRepository,
        private readonly asaas?: AsaasProviderPort
    ) {}

    async exec(input: GetSchoolPlanInvoicePixInput): Promise<GetSchoolPlanInvoicePixOutput> {
        const invoiceId = input.invoiceId.trim();
        const schoolId = input.schoolId.trim();
        if (!invoiceId) throw new Error('invoiceId is required');
        if (!schoolId) throw new Error('schoolId is required');

        const invoice = await this.invoices.findById(invoiceId);
        if (!invoice || invoice.schoolId !== schoolId) {
            throw new Error('Invoice not found');
        }

        // Se já temos PIX persistido, só retornar.
        if (invoice.pixQrCode || invoice.pixCopiaECola) {
            return {
                invoice: presentSchoolPlanInvoice(invoice),
                pixQrCode: invoice.pixQrCode,
                pixCopiaECola: invoice.pixCopiaECola
            };
        }

        const providerRef = invoice.providerRef?.trim() ?? '';
        if (!providerRef) {
            throw new Error('Invoice does not have providerRef');
        }

        if (!this.asaas?.getPixQrCode) {
            throw new Error('Asaas provider not configured');
        }

        const qr = await this.asaas.getPixQrCode(providerRef);
        const pixQrCode = typeof qr?.encodedImage === 'string' && qr.encodedImage.trim() ? qr.encodedImage : null;
        const pixCopiaECola = typeof qr?.payload === 'string' && qr.payload.trim() ? qr.payload : null;

        const updated = invoice.withChanges({
            pixQrCode,
            pixCopiaECola
        });
        await this.invoices.save(updated);

        return {
            invoice: presentSchoolPlanInvoice(updated),
            pixQrCode,
            pixCopiaECola
        };
    }
}

