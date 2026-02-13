import { Between } from 'typeorm';
import { AppDataSource } from './datasource';
import { SchoolFinancialChargeRepository, StudentPaymentInfo, PaidChargeSummary } from '../../../ports/repositories/school-financial-charge.repo';
import { SchoolFinancialCharge, SchoolFinancialChargeStatus } from '../../../domain/entities/school-financial-charge';
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

    async findByDateRange(startDate: Date, endDate: Date): Promise<SchoolFinancialCharge[]> {
        const rows = await this.repo.find({
            where: {
                dueDate: Between(startDate, endDate)
            }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async findByOwnerUserId(ownerUserId: string, filters?: {
        status?: SchoolFinancialChargeStatus;
        isPaid?: boolean;
    }): Promise<StudentPaymentInfo[]> {
        const queryBuilder = this.repo
            .createQueryBuilder('charge')
            .leftJoin('charge.course', 'course')
            .leftJoin('charge.student', 'studentUser')
            .leftJoin('charge.dependent', 'dependent')
            .where('charge.ownerUserId = :ownerUserId', { ownerUserId })
            .andWhere('charge.status != :cancelledStatus', { cancelledStatus: 'CANCELLED' })
            .select([
                'charge.id AS chargeId',
                'course.name AS courseName',
                'COALESCE(studentUser.fullName, dependent.fullName) AS studentName',
                'charge.netAmountCents AS amountCents',
                'charge.dueDate AS dueDate',
                'charge.status AS status'
            ])
            .orderBy('charge.dueDate', 'DESC');

        // Filtro por isPaid (pagos ou em aberto) - tem prioridade sobre status específico
        if (filters?.isPaid !== undefined) {
            if (filters.isPaid) {
                queryBuilder.andWhere('charge.status = :paidStatus', { paidStatus: 'PAID' });
            } else {
                queryBuilder.andWhere('charge.status IN (:...openStatuses)', { 
                    openStatuses: ['PENDING_SYNC', 'OPEN', 'OVERDUE'] 
                });
            }
        } else if (filters?.status) {
            // Aplicar filtro de status apenas se isPaid não foi especificado
            queryBuilder.andWhere('charge.status = :status', { status: filters.status });
        }

        const results = await queryBuilder.getRawMany();

        return results.map((row: any) => ({
            chargeId: row.chargeId,
            courseName: row.courseName,
            studentName: row.studentName,
            amountCents: row.amountCents,
            dueDate: new Date(row.dueDate),
            status: row.status as SchoolFinancialChargeStatus
        }));
    }

    async findPaidChargesBySchoolId(schoolId: string): Promise<PaidChargeSummary[]> {
        const queryBuilder = this.repo
            .createQueryBuilder('charge')
            .leftJoin('charge.ownerUser', 'owner')
            .leftJoin('charge.student', 'studentUser')
            .leftJoin('charge.dependent', 'dependent')
            .leftJoin('charge.course', 'course')
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.status = :status', { status: 'PAID' })
            .andWhere('charge.paidAt IS NOT NULL')
            .select([
                'charge.id AS id',
                'charge.netAmountCents AS netAmountCents',
                'charge.paidAt AS paidAt',
                'charge.description AS description',
                'studentUser.fullName AS studentUserName',
                'dependent.fullName AS dependentName',
                'owner.fullName AS ownerName',
                'course.name AS courseName'
            ])
            .orderBy('charge.paidAt', 'DESC');

        const results = await queryBuilder.getRawMany();

        return results.map((row: any) => ({
            id: row.id,
            netAmountCents: row.netAmountCents || 0,
            paidAt: new Date(row.paidAt),
            description: row.description,
            studentName: row.studentUserName || row.dependentName || row.ownerName || 'N/A',
            courseName: row.courseName || 'N/A'
        }));
    }

    async findLastTuitionCharge(
        enrollmentId: string,
        courseClassId: string,
        ownerUserId: string,
        studentUserId: string | null,
        dependentId: string | null
    ): Promise<SchoolFinancialCharge | null> {
        const queryBuilder = this.repo
            .createQueryBuilder('charge')
            .where('charge.courseClassId = :courseClassId', { courseClassId })
            .andWhere('charge.ownerUserId = :ownerUserId', { ownerUserId })
            .andWhere('charge.chargeType = :chargeType', { chargeType: 'TUITION' })
            .andWhere('charge.status != :cancelledStatus', { cancelledStatus: 'CANCELLED' });

        if (studentUserId) {
            queryBuilder.andWhere('charge.studentUserId = :studentUserId', { studentUserId });
        } else if (dependentId) {
            queryBuilder.andWhere('charge.dependentId = :dependentId', { dependentId });
        }

        const row = await queryBuilder
            .orderBy('charge.dueDate', 'DESC')
            .getOne();

        return row ? this.toDomain(row) : null;
    }

    async findTuitionChargesForMonth(
        courseClassId: string,
        ownerUserId: string,
        studentUserId: string | null,
        dependentId: string | null,
        year: number,
        month: number
    ): Promise<SchoolFinancialCharge[]> {
        const queryBuilder = this.repo
            .createQueryBuilder('charge')
            .where('charge.courseClassId = :courseClassId', { courseClassId })
            .andWhere('charge.ownerUserId = :ownerUserId', { ownerUserId })
            .andWhere('charge.chargeType = :chargeType', { chargeType: 'TUITION' })
            .andWhere('YEAR(charge.dueDate) = :year', { year })
            .andWhere('MONTH(charge.dueDate) = :month', { month })
            .andWhere('charge.status != :cancelledStatus', { cancelledStatus: 'CANCELLED' });

        if (studentUserId) {
            queryBuilder.andWhere('charge.studentUserId = :studentUserId', { studentUserId });
        } else if (dependentId) {
            queryBuilder.andWhere('charge.dependentId = :dependentId', { dependentId });
        }

        const rows = await queryBuilder.getMany();
        return rows.map((row) => this.toDomain(row));
    }

    async getRevenueHistory(schoolId: string, monthsLimit: number): Promise<Array<{ month: string; valueCents: number }>> {
        const results = await this.repo.createQueryBuilder('charge')
            .select([
                "DATE_FORMAT(charge.paidAt, '%Y-%m') AS month",
                'SUM(charge.netAmountCents) AS valueCents'
            ])
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.status = :status', { status: 'PAID' })
            .andWhere('charge.paidAt IS NOT NULL')
            .groupBy('month')
            .orderBy('month', 'DESC')
            .limit(monthsLimit)
            .getRawMany();

        return results.map(row => ({
            month: row.month,
            valueCents: Number(row.valueCents)
        })).reverse();
    }

    async getOverdueSummary(schoolId: string): Promise<{ totalAmountCents: number; count: number }> {
        const result = await this.repo.createQueryBuilder('charge')
            .select([
                'SUM(charge.netAmountCents) AS totalAmountCents',
                'COUNT(charge.id) AS count'
            ])
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.status = :status', { status: 'OVERDUE' })
            .getRawOne();

        return {
            totalAmountCents: Number(result.totalAmountCents || 0),
            count: Number(result.count || 0)
        };
    }

    async getPendingSummary(schoolId: string): Promise<{ totalAmountCents: number; count: number }> {
        const result = await this.repo.createQueryBuilder('charge')
            .select([
                'SUM(charge.netAmountCents) AS totalAmountCents',
                'COUNT(charge.id) AS count'
            ])
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.status IN (:...statuses)', { statuses: ['PENDING_SYNC', 'OPEN', 'FAILED'] })
            .getRawOne();

        return {
            totalAmountCents: Number(result.totalAmountCents || 0),
            count: Number(result.count || 0)
        };
    }

    async getRevenueForecast(schoolId: string, month: number, year: number): Promise<number> {
        const result = await this.repo.createQueryBuilder('charge')
            .select('SUM(charge.netAmountCents) AS total')
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.status IN (:...statuses)', { statuses: ['PENDING_SYNC', 'OPEN', 'OVERDUE'] })
            .andWhere('MONTH(charge.dueDate) = :month', { month })
            .andWhere('YEAR(charge.dueDate) = :year', { year })
            .getRawOne();

        return Number(result.total || 0);
    }

    async getCurrentMonthRevenue(schoolId: string, month: number, year: number): Promise<number> {
        const result = await this.repo.createQueryBuilder('charge')
            .select('SUM(charge.netAmountCents) AS total')
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.status = :status', { status: 'PAID' })
            .andWhere('charge.paidAt IS NOT NULL')
            .andWhere('MONTH(charge.paidAt) = :month', { month })
            .andWhere('YEAR(charge.paidAt) = :year', { year })
            .getRawOne();

        return Number(result.total || 0);
    }

    async getBillingConsolidatedByMonth(
        schoolId: string,
        monthsLimit: number
    ): Promise<Array<{ year: number; month: number; ganhoCents: number; pendenteCents: number; atrasadoCents: number; totalCents: number }>> {
        const limit = Math.min(Math.max(monthsLimit, 1), 60);

        const [ganhoRows, pendenteRows, atrasadoRows] = await Promise.all([
            this.repo.createQueryBuilder('charge')
                .select('YEAR(charge.paidAt) AS year', 'MONTH(charge.paidAt) AS month')
                .addSelect('SUM(charge.netAmountCents)', 'valueCents')
                .where('charge.schoolId = :schoolId', { schoolId })
                .andWhere('charge.status = :status', { status: 'PAID' })
                .andWhere('charge.paidAt IS NOT NULL')
                .groupBy('YEAR(charge.paidAt)')
                .addGroupBy('MONTH(charge.paidAt)')
                .getRawMany(),
            this.repo.createQueryBuilder('charge')
                .select('YEAR(charge.dueDate) AS year', 'MONTH(charge.dueDate) AS month')
                .addSelect('SUM(charge.netAmountCents)', 'valueCents')
                .where('charge.schoolId = :schoolId', { schoolId })
                .andWhere('charge.status IN (:...statuses)', { statuses: ['PENDING_SYNC', 'OPEN', 'FAILED'] })
                .groupBy('YEAR(charge.dueDate)')
                .addGroupBy('MONTH(charge.dueDate)')
                .getRawMany(),
            this.repo.createQueryBuilder('charge')
                .select('YEAR(charge.dueDate) AS year', 'MONTH(charge.dueDate) AS month')
                .addSelect('SUM(charge.netAmountCents)', 'valueCents')
                .where('charge.schoolId = :schoolId', { schoolId })
                .andWhere('charge.status = :status', { status: 'OVERDUE' })
                .groupBy('YEAR(charge.dueDate)')
                .addGroupBy('MONTH(charge.dueDate)')
                .getRawMany()
        ]);

        const key = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
        const map = new Map<string, { year: number; month: number; ganhoCents: number; pendenteCents: number; atrasadoCents: number }>();

        for (const row of ganhoRows as { year: number; month: number; valueCents: string }[]) {
            const y = Number(row.year);
            const m = Number(row.month);
            const k = key(y, m);
            map.set(k, {
                year: y,
                month: m,
                ganhoCents: Number(row.valueCents) || 0,
                pendenteCents: 0,
                atrasadoCents: 0
            });
        }
        for (const row of pendenteRows as { year: number; month: number; valueCents: string }[]) {
            const y = Number(row.year);
            const m = Number(row.month);
            const k = key(y, m);
            const existing = map.get(k);
            if (existing) {
                existing.pendenteCents = Number(row.valueCents) || 0;
            } else {
                map.set(k, {
                    year: y,
                    month: m,
                    ganhoCents: 0,
                    pendenteCents: Number(row.valueCents) || 0,
                    atrasadoCents: 0
                });
            }
        }
        for (const row of atrasadoRows as { year: number; month: number; valueCents: string }[]) {
            const y = Number(row.year);
            const m = Number(row.month);
            const k = key(y, m);
            const existing = map.get(k);
            if (existing) {
                existing.atrasadoCents = Number(row.valueCents) || 0;
            } else {
                map.set(k, {
                    year: y,
                    month: m,
                    ganhoCents: 0,
                    pendenteCents: 0,
                    atrasadoCents: Number(row.valueCents) || 0
                });
            }
        }

        const sorted = Array.from(map.values()).sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });

        return sorted.slice(0, limit).map((item) => ({
            year: item.year,
            month: item.month,
            ganhoCents: item.ganhoCents,
            pendenteCents: item.pendenteCents,
            atrasadoCents: item.atrasadoCents,
            totalCents: item.ganhoCents + item.pendenteCents + item.atrasadoCents
        }));
    }

    async countChargesWithDiscount(
        courseClassId: string,
        ownerUserId: string,
        studentUserId: string | null,
        dependentId: string | null
    ): Promise<number> {
        const queryBuilder = this.repo.createQueryBuilder('charge')
            .where('charge.courseClassId = :courseClassId', { courseClassId })
            .andWhere('charge.ownerUserId = :ownerUserId', { ownerUserId })
            .andWhere('charge.chargeType = :chargeType', { chargeType: 'TUITION' })
            .andWhere('charge.discountCents IS NOT NULL')
            .andWhere('charge.discountCents > 0');

        if (studentUserId) {
            queryBuilder.andWhere('charge.studentUserId = :studentUserId', { studentUserId });
        } else {
            queryBuilder.andWhere('charge.studentUserId IS NULL');
        }

        if (dependentId) {
            queryBuilder.andWhere('charge.dependentId = :dependentId', { dependentId });
        } else {
            queryBuilder.andWhere('charge.dependentId IS NULL');
        }

        const count = await queryBuilder.getCount();
        return count;
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


