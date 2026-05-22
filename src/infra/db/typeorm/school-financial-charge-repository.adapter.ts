import { Between } from 'typeorm';
import { AppDataSource } from './datasource';
import { SchoolFinancialChargeRepository, StudentPaymentInfo, StudentPaidTotalByYear, PaidChargeSummary, AdminStudentChargeItem } from '../../../ports/repositories/school-financial-charge.repo';
import { SchoolFinancialCharge, SchoolFinancialChargeStatus, SchoolFinancialChargeType } from '../../../domain/entities/school-financial-charge';
import { SchoolFinancialChargeOrm } from './entities/school-financial-charge.orm';

export class SchoolFinancialChargeRepositoryAdapter implements SchoolFinancialChargeRepository {
    private readonly repo = AppDataSource.getRepository(SchoolFinancialChargeOrm);

    async findById(id: string): Promise<SchoolFinancialCharge | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByAsaasPaymentId(asaasPaymentId: string): Promise<SchoolFinancialCharge | null> {
        const normalized = asaasPaymentId?.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({ where: { asaasPaymentId: normalized } });
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
        year?: number;
    }): Promise<StudentPaymentInfo[]> {
        const queryBuilder = this.repo
            .createQueryBuilder('charge')
            .leftJoin('charge.course', 'course')
            .leftJoin('charge.school', 'school')
            .leftJoin('charge.student', 'studentUser')
            .leftJoin('charge.dependent', 'dependent')
            .where('charge.ownerUserId = :ownerUserId', { ownerUserId })
            .andWhere('charge.status != :cancelledStatus', { cancelledStatus: 'CANCELLED' })
            .select([
            'charge.id AS chargeId',
            'course.name AS courseName',
            'COALESCE(studentUser.fullName, dependent.fullName) AS studentName',
            'charge.amountCents AS amountCents',
            'charge.discountCents AS discountCents',
            'charge.discountReason AS discountReason',
            'charge.netAmountCents AS netAmountCents',
            'charge.providerNetAmountCents AS providerNetAmountCents',
            'charge.dueDate AS dueDate',
            'charge.status AS status',
            'charge.chargeType AS chargeType',
            'charge.description AS description',
            'charge.schoolId AS schoolId',
            'school.name AS schoolName',
            'charge.paidAt AS paidAt',
            'charge.paidObservation AS paidObservation'
        ])
            .orderBy('charge.dueDate', 'ASC');

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

        if (filters?.year !== undefined) {
            const year = filters.year;
            if (filters.isPaid === true) {
                queryBuilder
                    .andWhere('charge.paidAt IS NOT NULL')
                    .andWhere('YEAR(charge.paidAt) = :filterYear', { filterYear: year });
            } else {
                queryBuilder.andWhere('YEAR(charge.dueDate) = :filterYear', { filterYear: year });
            }
        }

        const results = await queryBuilder.getRawMany();

        return results.map((row: any) => ({
            chargeId: row.chargeId,
            courseName: row.courseName,
            studentName: row.studentName,
            rawDescription: row.description ?? null,
            amountCents: row.amountCents ?? 0,
            discountCents: row.discountCents ?? null,
            discountReason: row.discountReason ?? null,
            netAmountCents: row.netAmountCents ?? row.amountCents ?? 0,
            providerNetAmountCents:
                row.providerNetAmountCents !== undefined && row.providerNetAmountCents !== null
                    ? Number(row.providerNetAmountCents)
                    : null,
            dueDate: new Date(row.dueDate),
            status: row.status as SchoolFinancialChargeStatus,
            chargeType: row.chargeType,
            schoolId: row.schoolId,
            schoolName: row.schoolName ?? '',
            paidAt: row.paidAt ? new Date(row.paidAt) : null,
            paidObservation: row.paidObservation ?? null
        }));
    }

    async getPaidTotalsByYearForOwnerUserId(ownerUserId: string): Promise<StudentPaidTotalByYear[]> {
        const rows = await this.repo
            .createQueryBuilder('charge')
            .select('YEAR(charge.paidAt)', 'year')
            .addSelect('SUM(charge.netAmountCents)', 'totalPaidCents')
            .addSelect('COUNT(charge.id)', 'paymentCount')
            .where('charge.ownerUserId = :ownerUserId', { ownerUserId })
            .andWhere('charge.status = :paidStatus', { paidStatus: 'PAID' })
            .andWhere('charge.paidAt IS NOT NULL')
            .groupBy('YEAR(charge.paidAt)')
            .orderBy('year', 'DESC')
            .getRawMany();

        return rows.map((row) => ({
            year: Number(row.year),
            totalPaidCents: Number(row.totalPaidCents ?? 0),
            paymentCount: Number(row.paymentCount ?? 0)
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

    async findEarliestTuitionCharge(
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

        const row = await queryBuilder.orderBy('charge.dueDate', 'ASC').getOne();

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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const qb = this.repo
            .createQueryBuilder('charge')
            .select([
                'SUM(charge.netAmountCents) AS totalAmountCents',
                'COUNT(charge.id) AS count'
            ])
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.status != :cancelled', { cancelled: 'CANCELLED' })
            .andWhere(
                '(charge.status = :overdueStatus OR (charge.status IN (:...openStatuses) AND charge.dueDate < :today))',
                {
                    overdueStatus: 'OVERDUE',
                    openStatuses: ['PENDING_SYNC', 'OPEN'],
                    today
                }
            );

        const result = await qb.getRawOne();

        return {
            totalAmountCents: Number(result?.totalAmountCents || 0),
            count: Number(result?.count || 0)
        };
    }

    async getPendingSummary(schoolId: string): Promise<{ totalAmountCents: number; count: number }> {
        const result = await this.repo.createQueryBuilder('charge')
            .select([
                'SUM(charge.netAmountCents) AS totalAmountCents',
                'COUNT(charge.id) AS count'
            ])
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.status IN (:...statuses)', {
                statuses: ['PENDING_SYNC', 'OPEN', 'OVERDUE', 'FAILED']
            })
            .getRawOne();

        return {
            totalAmountCents: Number(result?.totalAmountCents || 0),
            count: Number(result?.count || 0)
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
                .select('YEAR(charge.paidAt) AS year, MONTH(charge.paidAt) AS month, SUM(charge.netAmountCents) AS valueCents')
                .where('charge.schoolId = :schoolId', { schoolId })
                .andWhere('charge.status = :status', { status: 'PAID' })
                .andWhere('charge.paidAt IS NOT NULL')
                .groupBy('YEAR(charge.paidAt)')
                .addGroupBy('MONTH(charge.paidAt)')
                .getRawMany(),
            this.repo.createQueryBuilder('charge')
                .select('YEAR(charge.dueDate) AS year, MONTH(charge.dueDate) AS month, SUM(charge.netAmountCents) AS valueCents')
                .where('charge.schoolId = :schoolId', { schoolId })
                .andWhere('charge.status IN (:...statuses)', { statuses: ['PENDING_SYNC', 'OPEN', 'FAILED'] })
                .groupBy('YEAR(charge.dueDate)')
                .addGroupBy('MONTH(charge.dueDate)')
                .getRawMany(),
            this.repo.createQueryBuilder('charge')
                .select('YEAR(charge.dueDate) AS year, MONTH(charge.dueDate) AS month, SUM(charge.netAmountCents) AS valueCents')
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

    async getTuitionRevenueByMonthForDashboard(monthsLimit: number): Promise<Array<{ year: number; month: number; valorCents: number }>> {
        const limit = Math.min(Math.max(monthsLimit, 1), 24);
        const rows = await this.repo
            .createQueryBuilder('charge')
            .select('YEAR(charge.paidAt) AS year, MONTH(charge.paidAt) AS month, SUM(charge.netAmountCents) AS valorCents')
            .where("charge.status = 'PAID'")
            .andWhere('charge.paidAt IS NOT NULL')
            .groupBy('YEAR(charge.paidAt)')
            .addGroupBy('MONTH(charge.paidAt)')
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

    async getOverdueTotalCents(): Promise<number> {
        const row = await this.repo
            .createQueryBuilder('charge')
            .select('COALESCE(SUM(charge.netAmountCents), 0)', 'total')
            .where("charge.status = 'OVERDUE'")
            .getRawOne<{ total: string }>();
        return Math.floor(Number(row?.total ?? 0));
    }

    async findChargesByStudentIdForAdmin(studentId: string, studentType: 'USER' | 'DEPENDENT'): Promise<AdminStudentChargeItem[]> {
        const qb = this.repo
            .createQueryBuilder('charge')
            .innerJoin('charge.school', 'school')
            .innerJoin('charge.course', 'course')
            .innerJoin('charge.courseClass', 'class')
            .where('charge.status != :cancelled', { cancelled: 'CANCELLED' });

        if (studentType === 'USER') {
            qb.andWhere('charge.studentUserId = :studentId', { studentId });
        } else {
            qb.andWhere('charge.dependentId = :studentId', { studentId });
        }

        const rows = await qb
            .select([
                'charge.id AS id',
                'charge.amountCents AS amountCents',
                'charge.discountCents AS discountCents',
                'charge.discountReason AS discountReason',
                'charge.netAmountCents AS netAmountCents',
                'charge.description AS description',
                'charge.chargeType AS chargeType',
                'charge.dueDate AS dueDate',
                'charge.status AS status',
                'charge.paidAt AS paidAt',
                'school.id AS schoolId',
                'school.name AS schoolName',
                'course.id AS courseId',
                'course.name AS courseName',
                'class.id AS classId',
                'class.label AS classLabel'
            ])
            .orderBy('charge.dueDate', 'DESC')
            .getRawMany();

        return rows.map((row: any) => ({
            id: row.id,
            school: { id: row.schoolId, name: row.schoolName ?? '' },
            course: { id: row.courseId, name: row.courseName ?? '' },
            class: { id: row.classId, label: row.classLabel ?? '' },
            amountCents: row.amountCents ?? 0,
            discountCents: row.discountCents ?? null,
            discountReason: row.discountReason ?? null,
            netAmountCents: row.netAmountCents ?? 0,
            description: row.description ?? null,
            chargeType: (row.chargeType ?? 'OTHER') as SchoolFinancialChargeType,
            dueDate: new Date(row.dueDate),
            status: row.status as SchoolFinancialChargeStatus,
            paidAt: row.paidAt ? new Date(row.paidAt) : null
        }));
    }

    async findChargesByOwnerIdIncludingDependentsForAdmin(ownerUserId: string): Promise<AdminStudentChargeItem[]> {
        const qb = this.repo
            .createQueryBuilder('charge')
            .innerJoin('charge.school', 'school')
            .innerJoin('charge.course', 'course')
            .innerJoin('charge.courseClass', 'class')
            .where('charge.status != :cancelled', { cancelled: 'CANCELLED' })
            .andWhere(
                '(charge.studentUserId = :ownerUserId OR (charge.ownerUserId = :ownerUserId AND charge.dependentId IS NOT NULL))',
                { ownerUserId }
            );

        const rows = await qb
            .select([
                'charge.id AS id',
                'charge.amountCents AS amountCents',
                'charge.discountCents AS discountCents',
                'charge.discountReason AS discountReason',
                'charge.netAmountCents AS netAmountCents',
                'charge.description AS description',
                'charge.chargeType AS chargeType',
                'charge.dueDate AS dueDate',
                'charge.status AS status',
                'charge.paidAt AS paidAt',
                'school.id AS schoolId',
                'school.name AS schoolName',
                'course.id AS courseId',
                'course.name AS courseName',
                'class.id AS classId',
                'class.label AS classLabel'
            ])
            .orderBy('charge.dueDate', 'DESC')
            .getRawMany();

        return rows.map((row: any) => ({
            id: row.id,
            school: { id: row.schoolId, name: row.schoolName ?? '' },
            course: { id: row.courseId, name: row.courseName ?? '' },
            class: { id: row.classId, label: row.classLabel ?? '' },
            amountCents: row.amountCents ?? 0,
            discountCents: row.discountCents ?? null,
            discountReason: row.discountReason ?? null,
            netAmountCents: row.netAmountCents ?? 0,
            description: row.description ?? null,
            chargeType: (row.chargeType ?? 'OTHER') as SchoolFinancialChargeType,
            dueDate: new Date(row.dueDate),
            status: row.status as SchoolFinancialChargeStatus,
            paidAt: row.paidAt ? new Date(row.paidAt) : null
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
            providerNetAmountCents: row.providerNetAmountCents ?? null,
            dueDate: row.dueDate,
            status: row.status,
            asaasPaymentId: row.asaasPaymentId,
            asaasInvoiceUrl: row.asaasInvoiceUrl,
            asaasPayload: row.asaasPayload,
            paidAt: row.paidAt,
            paymentMethod: row.paymentMethod ?? null,
            paidObservation: row.paidObservation ?? null,
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
            providerNetAmountCents: charge.providerNetAmountCents,
            dueDate: charge.dueDate,
            status: charge.status,
            asaasPaymentId: charge.asaasPaymentId,
            asaasInvoiceUrl: charge.asaasInvoiceUrl,
            asaasPayload: charge.asaasPayload,
            paidAt: charge.paidAt,
            paymentMethod: charge.paymentMethod,
            paidObservation: charge.paidObservation,
            cancelledAt: charge.cancelledAt,
            createdAt: charge.createdAt,
            updatedAt: charge.updatedAt
        });
        return row;
    }
}


