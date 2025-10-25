import { AppDataSource } from './datasource';
import { SchoolFinancialChargeRepository } from '../../../ports/repositories/school-financial-charge.repo';
import { SchoolFinancialCharge } from '../../../domain/entities/school-financial-charge';
import { SchoolFinancialChargeOrm } from './entities/school-financial-charge.orm';

export class SchoolFinancialChargeRepositoryAdapter implements SchoolFinancialChargeRepository {
    private readonly repo = AppDataSource.getRepository(SchoolFinancialChargeOrm);

    async findById(id: string): Promise<SchoolFinancialCharge | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async save(charge: SchoolFinancialCharge): Promise<void> {
        await this.repo.save(this.toOrm(charge));
    }

    private toDomain(row: SchoolFinancialChargeOrm): SchoolFinancialCharge {
        return SchoolFinancialCharge.restore({
            id: row.id,
            schoolId: row.schoolId,
            ownerUserId: row.ownerUserId,
            studentUserId: row.studentUserId,
            dependentId: row.dependentId,
            courseId: row.courseId,
            courseClassId: row.courseClassId,
            chargeType: row.chargeType,
            description: row.description,
            amountCents: row.amountCents,
            discountCents: row.discountCents,
            discountReason: row.discountReason,
            netAmountCents: row.netAmountCents,
            dueDate: row.dueDate,
            status: row.status,
            asaasPaymentId: row.asaasPaymentId,
            asaasInvoiceUrl: row.asaasInvoiceUrl,
            asaasPayload: row.asaasPayload,
            paidAt: row.paidAt,
            cancelledAt: row.cancelledAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        });
    }

    private toOrm(charge: SchoolFinancialCharge): SchoolFinancialChargeOrm {
        const row = this.repo.create({
            id: charge.id,
            schoolId: charge.schoolId,
            ownerUserId: charge.ownerUserId,
            studentUserId: charge.studentUserId,
            dependentId: charge.dependentId,
            courseId: charge.courseId,
            courseClassId: charge.courseClassId,
            chargeType: charge.chargeType,
            description: charge.description,
            amountCents: charge.amountCents,
            discountCents: charge.discountCents,
            discountReason: charge.discountReason,
            netAmountCents: charge.netAmountCents,
            dueDate: charge.dueDate,
            status: charge.status,
            asaasPaymentId: charge.asaasPaymentId,
            asaasInvoiceUrl: charge.asaasInvoiceUrl,
            asaasPayload: charge.asaasPayload,
            paidAt: charge.paidAt,
            cancelledAt: charge.cancelledAt,
            createdAt: charge.createdAt,
            updatedAt: charge.updatedAt
        });
        return row;
    }
}
