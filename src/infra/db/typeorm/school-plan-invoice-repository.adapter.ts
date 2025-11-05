import { AppDataSource } from './datasource';
import { SchoolPlanInvoiceRepository } from '../../../ports/repositories/school-plan-invoice.repo';
import { SchoolPlanInvoiceOrm } from './entities/school-plan-invoice.orm';
import { SchoolPlanInvoice } from '../../../domain/entities/school-plan-invoice';

export class SchoolPlanInvoiceRepositoryAdapter implements SchoolPlanInvoiceRepository {
    private readonly repo = AppDataSource.getRepository(SchoolPlanInvoiceOrm);

    async findByFinanceIdAndDueDate(financeId: string, dueDate: Date): Promise<SchoolPlanInvoice | null> {
        const normalizedFinanceId = financeId.trim();
        if (!normalizedFinanceId) return null;

        const dueDateIso = dueDate.toISOString().slice(0, 10);

        const row = await this.repo.findOne({
            where: {
                financeId: normalizedFinanceId,
                dueDate: dueDateIso
            }
        });

        return row ? this.toDomain(row) : null;
    }

    async findByProviderRef(providerRef: string): Promise<SchoolPlanInvoice | null> {
        const normalized = providerRef.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({ where: { providerRef: normalized } });
        return row ? this.toDomain(row) : null;
    }

    async findByExternalReference(externalReference: string): Promise<SchoolPlanInvoice | null> {
        const normalized = externalReference.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({ where: { externalReference: normalized } });
        return row ? this.toDomain(row) : null;
    }

    async findByFinanceId(financeId: string): Promise<SchoolPlanInvoice[]> {
        const normalized = financeId.trim();
        if (!normalized) return [];
        const rows = await this.repo.find({
            where: { financeId: normalized },
            order: { dueDate: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async save(invoice: SchoolPlanInvoice): Promise<void> {
        const existing = await this.repo.findOne({ where: { id: invoice.id } });
        const row = existing ?? new SchoolPlanInvoiceOrm();
        row.id = invoice.id;
        row.financeId = invoice.financeId;
        row.schoolId = invoice.schoolId;
        row.planId = invoice.planId;
        row.amountCents = invoice.amountCents;
        row.currency = invoice.currency;
        row.status = invoice.status;
        row.dueDate = invoice.dueDate.toISOString().slice(0, 10);
        row.paidAt = invoice.paidAt;
        row.description = invoice.description;
        row.providerRef = invoice.providerRef;
        row.boletoUrl = invoice.boletoUrl;
        row.digitableLine = invoice.digitableLine;
        row.barcode = invoice.barcode;
        row.externalReference = invoice.externalReference;
        row.metadata = Object.keys(invoice.metadata).length ? { ...invoice.metadata } : null;
        if (!existing) {
            row.createdAt = invoice.createdAt;
        }
        row.updatedAt = invoice.updatedAt;

        await this.repo.save(row);
    }

    private toDomain(row: SchoolPlanInvoiceOrm): SchoolPlanInvoice {
        return SchoolPlanInvoice.create({
            id: row.id,
            financeId: row.financeId,
            schoolId: row.schoolId,
            planId: row.planId,
            amountCents: row.amountCents,
            currency: row.currency,
            status: row.status,
            dueDate: new Date(`${row.dueDate}T00:00:00Z`),
            description: row.description,
            providerRef: row.providerRef,
            boletoUrl: row.boletoUrl,
            digitableLine: row.digitableLine,
            barcode: row.barcode,
            externalReference: row.externalReference,
            metadata: row.metadata ? { ...row.metadata } : undefined,
            paidAt: row.paidAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        });
    }
}


