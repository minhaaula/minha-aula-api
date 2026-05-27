import { AppDataSource } from './datasource';
import {
    SchoolPlanInvoiceRepository,
    PaymentHistoryFilters,
    PaymentHistoryResult,
    PaymentHistoryTotals
} from '../../../ports/repositories/school-plan-invoice.repo';
import { SchoolPlanInvoiceOrm } from './entities/school-plan-invoice.orm';
import { SchoolOrm } from './entities/school.orm';
import { SchoolPlanInvoice } from '../../../domain/entities/school-plan-invoice';
import { IsNull, Not, Between } from 'typeorm';

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

    async findById(id: string): Promise<SchoolPlanInvoice | null> {
        const normalized = id?.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({ where: { id: normalized } });
        return row ? this.toDomain(row) : null;
    }

    async hasSchoolAnyPaidInvoice(schoolId: string): Promise<boolean> {
        const normalized = schoolId?.trim();
        if (!normalized) return false;
        const count = await this.repo.count({ where: { schoolId: normalized, status: 'PAID' } });
        return count > 0;
    }

    async getSchoolIdsWithPaidInvoice(schoolIds: string[]): Promise<Set<string>> {
        const normalized = schoolIds.map((id) => id?.trim()).filter(Boolean);
        if (normalized.length === 0) return new Set();
        const rows = await this.repo
            .createQueryBuilder('inv')
            .select('DISTINCT inv.schoolId')
            .where('inv.schoolId IN (:...ids)', { ids: normalized })
            .andWhere("inv.status = 'PAID'")
            .getRawMany<{ schoolId: string }>();
        return new Set(rows.map((r) => r.schoolId));
    }

    async getSchoolIdsWithOverdueInvoice(schoolIds: string[]): Promise<Set<string>> {
        const normalized = schoolIds.map((id) => id?.trim()).filter(Boolean);
        if (normalized.length === 0) return new Set();
        const today = new Date().toISOString().slice(0, 10);
        const rows = await this.repo
            .createQueryBuilder('inv')
            .select('DISTINCT inv.schoolId', 'schoolId')
            .where('inv.schoolId IN (:...ids)', { ids: normalized })
            .andWhere("inv.status = 'ISSUED'")
            .andWhere('inv.dueDate < :today', { today })
            .getRawMany<{ schoolId: string }>();
        return new Set(rows.map((r) => r.schoolId));
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

    async countByFinanceIdAndDiscountCouponId(
        financeId: string,
        discountCouponId: string
    ): Promise<number> {
        const normalizedFinanceId = financeId.trim();
        const normalizedCouponId = discountCouponId.trim();
        if (!normalizedFinanceId || !normalizedCouponId) return 0;
        return this.repo.count({
            where: {
                financeId: normalizedFinanceId,
                discountCouponId: normalizedCouponId
            }
        });
    }

    async findBySchoolId(schoolId: string): Promise<SchoolPlanInvoice[]> {
        const normalized = schoolId.trim();
        if (!normalized) return [];
        const rows = await this.repo.find({
            where: { schoolId: normalized },
            order: { dueDate: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async findPaidWithoutReceiptUrl(limit: number): Promise<SchoolPlanInvoice[]> {
        const rows = await this.repo.find({
            where: {
                status: 'PAID',
                receiptUrl: IsNull()
            },
            take: limit,
            order: { paidAt: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async findIssuedWithProviderRef(limit: number, daysAgo: number = 7): Promise<SchoolPlanInvoice[]> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
        cutoffDate.setHours(0, 0, 0, 0);

        const rows = await this.repo
            .createQueryBuilder('invoice')
            .where('invoice.status = :status', { status: 'ISSUED' })
            .andWhere('invoice.providerRef IS NOT NULL')
            .andWhere('invoice.providerRef != :empty', { empty: '' })
            .andWhere('invoice.createdAt >= :cutoffDate', { cutoffDate: cutoffDate.toISOString() })
            .orderBy('invoice.createdAt', 'DESC')
            .limit(limit)
            .getMany();

        return rows.map((row) => this.toDomain(row));
    }

    async findIssuedByDueDateRange(startDate: Date, endDate: Date): Promise<SchoolPlanInvoice[]> {
        const startStr = startDate.toISOString().slice(0, 10);
        const endStr = endDate.toISOString().slice(0, 10);
        const rows = await this.repo.find({
            where: {
                status: 'ISSUED',
                dueDate: Between(startStr, endStr),
                boletoUrl: Not(IsNull())
            },
            order: { dueDate: 'ASC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async findPaymentHistoryPaginated(
        filters: PaymentHistoryFilters,
        limit: number,
        offset: number
    ): Promise<PaymentHistoryResult> {
        const schoolName = filters.schoolName?.trim() || null;
        const status = filters.status?.trim() || null;
        const month = filters.month != null && filters.month >= 1 && filters.month <= 12 ? filters.month : null;
        const year = filters.year != null && filters.year >= 2000 && filters.year <= 3000 ? filters.year : null;
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safeOffset = Math.max(0, offset);

        const qb = this.repo
            .createQueryBuilder('invoice')
            .innerJoin(SchoolOrm, 'school', 'school.id = invoice.schoolId')
            .select([
                'invoice.id AS id',
                'invoice.schoolId AS schoolId',
                'school.name AS schoolName',
                'school.cnpj AS schoolCnpj',
                'school.ownerCpf AS schoolOwnerCpf',
                'invoice.planId AS planId',
                'invoice.financeId AS financeId',
                'invoice.status AS status',
                'invoice.amountCents AS amountCents',
                'invoice.currency AS currency',
                'invoice.dueDate AS dueDate',
                'invoice.paidAt AS paidAt',
                'invoice.description AS description',
                'invoice.createdAt AS createdAt'
            ])
            .orderBy('invoice.dueDate', 'DESC')
            .addOrderBy('invoice.createdAt', 'DESC')
            .skip(safeOffset)
            .take(safeLimit);

        if (schoolName) {
            qb.andWhere('LOWER(school.name) LIKE LOWER(:schoolName)', { schoolName: `%${schoolName}%` });
        }
        if (status) {
            qb.andWhere('invoice.status = :status', { status });
        }
        if (month != null) {
            qb.andWhere('MONTH(invoice.dueDate) = :month', { month });
        }
        if (year != null) {
            qb.andWhere('YEAR(invoice.dueDate) = :year', { year });
        }

        const countQb = this.repo
            .createQueryBuilder('invoice')
            .innerJoin(SchoolOrm, 'school', 'school.id = invoice.schoolId')
            .where('1 = 1');

        if (schoolName) {
            countQb.andWhere('LOWER(school.name) LIKE LOWER(:schoolName)', { schoolName: `%${schoolName}%` });
        }
        if (status) {
            countQb.andWhere('invoice.status = :status', { status });
        }
        if (month != null) {
            countQb.andWhere('MONTH(invoice.dueDate) = :month', { month });
        }
        if (year != null) {
            countQb.andWhere('YEAR(invoice.dueDate) = :year', { year });
        }

        const [rawRows, total] = await Promise.all([qb.getRawMany(), countQb.getCount()]);

        const items = (rawRows as any[]).map((row) => {
            const schoolCnpj =
                typeof row.schoolCnpj === 'string' && row.schoolCnpj.trim() ? row.schoolCnpj.trim() : null;
            const schoolOwnerCpf =
                typeof row.schoolOwnerCpf === 'string' && row.schoolOwnerCpf.trim()
                    ? row.schoolOwnerCpf.trim()
                    : null;
            return {
            id: row.id,
            schoolId: row.schoolId,
            schoolName: row.schoolName ?? '',
            schoolCnpj,
            cpf: schoolCnpj ? null : schoolOwnerCpf,
            planId: row.planId,
            financeId: row.financeId,
            status: row.status,
            amountCents: Number(row.amountCents) || 0,
            currency: row.currency ?? 'BRL',
            dueDate: new Date(row.dueDate),
            paidAt: row.paidAt ? new Date(row.paidAt) : null,
            description: row.description ?? null,
            createdAt: new Date(row.createdAt)
        };
        });

        return {
            items,
            total,
            limit: safeLimit,
            offset: safeOffset
        };
    }

    async getRevenueByMonthForDashboard(monthsLimit: number): Promise<Array<{ year: number; month: number; valorCents: number }>> {
        const limit = Math.min(Math.max(monthsLimit, 1), 24);
        const rows = await this.repo
            .createQueryBuilder('inv')
            .select('YEAR(inv.paidAt) AS year, MONTH(inv.paidAt) AS month, SUM(inv.amountCents) AS valorCents')
            .where("inv.status = 'PAID'")
            .andWhere('inv.paidAt IS NOT NULL')
            .groupBy('YEAR(inv.paidAt)')
            .addGroupBy('MONTH(inv.paidAt)')
            .orderBy('year', 'DESC')
            .addOrderBy('month', 'DESC')
            .limit(limit)
            .getRawMany();
        return (rows as any[]).map((r) => ({
            year: Number(r.year),
            month: Number(r.month),
            valorCents: Math.floor(Number(r.valorCents) || 0)
        })).reverse();
    }

    async getPaymentStatusSummaryForMonth(year: number, month: number): Promise<Array<{ status: string; count: number; valorCents: number }>> {
        const today = new Date().toISOString().slice(0, 10);
        const baseWhere = { year, month, today };

        const [paid, issued, overdue] = await Promise.all([
            this.repo
                .createQueryBuilder('inv')
                .select('COUNT(inv.id)', 'count')
                .addSelect('COALESCE(SUM(inv.amountCents), 0)', 'valorCents')
                .where("inv.status = 'PAID'")
                .andWhere('YEAR(inv.dueDate) = :year', baseWhere)
                .andWhere('MONTH(inv.dueDate) = :month', baseWhere)
                .getRawOne<{ count: string; valorCents: string }>(),
            this.repo
                .createQueryBuilder('inv')
                .select('COUNT(inv.id)', 'count')
                .addSelect('COALESCE(SUM(inv.amountCents), 0)', 'valorCents')
                .where("inv.status = 'ISSUED'")
                .andWhere('YEAR(inv.dueDate) = :year', baseWhere)
                .andWhere('MONTH(inv.dueDate) = :month', baseWhere)
                .andWhere('inv.dueDate >= :today', baseWhere)
                .getRawOne<{ count: string; valorCents: string }>(),
            this.repo
                .createQueryBuilder('inv')
                .select('COUNT(inv.id)', 'count')
                .addSelect('COALESCE(SUM(inv.amountCents), 0)', 'valorCents')
                .where("inv.status = 'ISSUED'")
                .andWhere('YEAR(inv.dueDate) = :year', baseWhere)
                .andWhere('MONTH(inv.dueDate) = :month', baseWhere)
                .andWhere('inv.dueDate < :today', baseWhere)
                .getRawOne<{ count: string; valorCents: string }>()
        ]);

        const result: Array<{ status: string; count: number; valorCents: number }> = [];
        if (Number(paid?.count ?? 0) > 0) result.push({ status: 'Pago', count: Number(paid!.count), valorCents: Math.floor(Number(paid!.valorCents) || 0) });
        if (Number(issued?.count ?? 0) > 0) result.push({ status: 'Emitido', count: Number(issued!.count), valorCents: Math.floor(Number(issued!.valorCents) || 0) });
        if (Number(overdue?.count ?? 0) > 0) result.push({ status: 'Atrasado', count: Number(overdue!.count), valorCents: Math.floor(Number(overdue!.valorCents) || 0) });
        return result;
    }

    async getPaymentHistoryTotals(): Promise<PaymentHistoryTotals> {
        const today = new Date().toISOString().slice(0, 10);
        const [receivedRow, overdueRow] = await Promise.all([
            this.repo
                .createQueryBuilder('inv')
                .select('COALESCE(SUM(inv.amountCents), 0)', 'total')
                .where("inv.status = 'PAID'")
                .getRawOne<{ total: string }>(),
            this.repo
                .createQueryBuilder('inv')
                .select('COALESCE(SUM(inv.amountCents), 0)', 'total')
                .where("inv.status = 'ISSUED'")
                .andWhere('inv.dueDate < :today', { today })
                .getRawOne<{ total: string }>()
        ]);
        return {
            totalReceivedCents: Math.floor(Number(receivedRow?.total ?? 0)),
            totalOverdueCents: Math.floor(Number(overdueRow?.total ?? 0))
        };
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
        row.pixQrCode = invoice.pixQrCode;
        row.pixCopiaECola = invoice.pixCopiaECola;
        row.externalReference = invoice.externalReference;
        row.receiptUrl = invoice.receiptUrl;
        row.discountCouponId = invoice.discountCouponId;
        row.discountPercentage = invoice.discountPercentage;
        row.discountAmountCents = invoice.discountAmountCents;
        row.originalAmountCents = invoice.originalAmountCents;
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
            pixQrCode: row.pixQrCode,
            pixCopiaECola: row.pixCopiaECola,
            externalReference: row.externalReference,
            receiptUrl: row.receiptUrl,
            metadata: row.metadata ? { ...row.metadata } : undefined,
            paidAt: row.paidAt,
            discountCouponId: row.discountCouponId,
            discountPercentage: row.discountPercentage ? Number(row.discountPercentage) : undefined,
            discountAmountCents: row.discountAmountCents,
            originalAmountCents: row.originalAmountCents,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        });
    }
}


