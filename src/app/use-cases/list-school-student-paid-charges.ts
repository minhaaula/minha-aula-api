import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { AppDataSource } from '../../infra/db/typeorm/datasource';
import { EnrollmentOrm } from '../../infra/db/typeorm/entities/enrollment.orm';
import { SchoolFinancialChargeOrm } from '../../infra/db/typeorm/entities/school-financial-charge.orm';
import { SchoolFinancialChargeStatus } from '../../domain/entities/school-financial-charge';
import type { SchoolPaymentStatusDisplay } from '../types/payment.types';
import { AppError, ErrorCode } from '../../shared/errors';
import { equalUuid } from '../../shared/normalize-uuid';
import { formatSchoolChargeDescriptionForSchoolUi } from '../../shared/format-school-charge-description';
import { isOpenChargeCalendarOverdue } from '../../shared/billing-due-date';
import { sortSchoolChargesByDisplayStatusAndDueDate } from '../../shared/school-charge-list-order';

export type SchoolStudentPaidChargeItem = {
    id: string;
    amount: number;
    amountCents: number;
    discount: number | null;
    discountCents: number | null;
    discountReason: string | null;
    netAmount: number;
    netAmountCents: number;
    /** Líquido retornado pelo provedor (ex.: Asaas `netValue`), em reais; só após pagamento quando disponível. */
    providerNetAmount: number | null;
    /** Líquido retornado pelo provedor (centavos). */
    providerNetAmountCents: number | null;
    description: string | null;
    dueDate: Date;
    paidAt: Date | null;
    /** Meio de pagamento registrado no pagamento (PIX, BOLETO, MANUAL); `null` se ainda não pago ou não informado. */
    paymentMethod: 'PIX' | 'BOLETO' | 'MANUAL' | null;
    status: string;
    statusDisplay: SchoolPaymentStatusDisplay;
    course: {
        id: string;
        name: string;
    };
    class: {
        id: string;
        label: string;
    };
};

export interface ListSchoolStudentPaidChargesInput {
    schoolId: string;
    studentId: string;
    dependentId?: string | null;
    limit: number;
    offset: number;
}

export interface ListSchoolStudentPaidChargesOutput {
    paidCharges: SchoolStudentPaidChargeItem[];
    total: number;
    limit: number;
    offset: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class ListSchoolStudentPaidCharges {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: ListSchoolStudentPaidChargesInput): Promise<ListSchoolStudentPaidChargesOutput | null> {
        const schoolId = input.schoolId.trim();
        const studentId = input.studentId.trim();
        const dependentIdParam = input.dependentId?.trim() || null;
        const limit = Math.min(Math.max(input.limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
        const offset = Math.max(input.offset ?? 0, 0);

        if (!schoolId || !studentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'schoolId e studentId são obrigatórios'
            });
        }

        if (dependentIdParam) {
            const dependent = await this.dependents.findById(dependentIdParam);
            if (!dependent || !equalUuid(dependent.userId, studentId)) {
                return null;
            }
            const hasEnrollment = await this.checkStudentEnrollmentInSchool(schoolId, dependent.id);
            if (!hasEnrollment) {
                return null;
            }
            const { rows, total } = await this.findPaidChargesPageForDependent(schoolId, dependent.id, limit, offset);
            return { paidCharges: rows, total, limit, offset };
        }

        const hasEnrollment = await this.checkStudentEnrollmentInSchool(schoolId, studentId);
        if (!hasEnrollment) {
            return null;
        }

        const dependent = await this.dependents.findById(studentId);
        if (dependent) {
            const { rows, total } = await this.findPaidChargesPageForDependent(schoolId, dependent.id, limit, offset);
            return { paidCharges: rows, total, limit, offset };
        }

        const user = await this.users.findById(studentId);
        if (!user) {
            throw AppError.fromCode(ErrorCode.STUDENT_NOT_FOUND, { studentId });
        }

        const { rows, total } = await this.findPaidChargesPageForUser(schoolId, user.id, limit, offset);
        return { paidCharges: rows, total, limit, offset };
    }

    private async checkStudentEnrollmentInSchool(schoolId: string, studentId: string): Promise<boolean> {
        const enrollmentRepo = AppDataSource.getRepository(EnrollmentOrm);

        const userEnrollment = await enrollmentRepo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.studentUserId = :studentId', { studentId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getCount();

        if (userEnrollment > 0) {
            return true;
        }

        const dependentEnrollment = await enrollmentRepo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.dependentId = :studentId', { studentId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getCount();

        return dependentEnrollment > 0;
    }

    private async findPaidChargesPageForUser(
        schoolId: string,
        userId: string,
        limit: number,
        offset: number
    ): Promise<{ rows: SchoolStudentPaidChargeItem[]; total: number }> {
        const chargeRepo = AppDataSource.getRepository(SchoolFinancialChargeOrm);

        const base = chargeRepo
            .createQueryBuilder('charge')
            .innerJoin('charge.course', 'course')
            .innerJoin('charge.courseClass', 'class')
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.studentUserId = :userId', { userId })
            .andWhere('charge.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['CANCELLED'] });

        return this.fetchSortedPaidChargesPage(base, limit, offset);
    }

    private async findPaidChargesPageForDependent(
        schoolId: string,
        dependentId: string,
        limit: number,
        offset: number
    ): Promise<{ rows: SchoolStudentPaidChargeItem[]; total: number }> {
        const chargeRepo = AppDataSource.getRepository(SchoolFinancialChargeOrm);

        const base = chargeRepo
            .createQueryBuilder('charge')
            .innerJoin('charge.course', 'course')
            .innerJoin('charge.courseClass', 'class')
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.dependentId = :dependentId', { dependentId })
            .andWhere('charge.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['CANCELLED'] });

        return this.fetchSortedPaidChargesPage(base, limit, offset);
    }

    private async fetchSortedPaidChargesPage(
        base: ReturnType<typeof AppDataSource.getRepository<SchoolFinancialChargeOrm>['createQueryBuilder']>,
        limit: number,
        offset: number
    ): Promise<{ rows: SchoolStudentPaidChargeItem[]; total: number }> {
        const charges = await base
            .select([
                'charge.id AS charge_id',
                'charge.amountCents AS charge_amount_cents',
                'charge.discountCents AS charge_discount_cents',
                'charge.discountReason AS charge_discount_reason',
                'charge.netAmountCents AS charge_net_amount_cents',
                'charge.providerNetAmountCents AS charge_provider_net_amount_cents',
                'charge.description AS charge_description',
                'charge.chargeType AS charge_charge_type',
                'charge.dueDate AS charge_due_date',
                'charge.paidAt AS charge_paid_at',
                'charge.paymentMethod AS charge_payment_method',
                'charge.status AS charge_status',
                'course.id AS course_id',
                'course.name AS course_name',
                'class.id AS class_id',
                'class.label AS class_label'
            ])
            .getRawMany();

        const sorted = sortSchoolChargesByDisplayStatusAndDueDate(charges.map((row: any) => this.mapRow(row)));
        return {
            rows: sorted.slice(offset, offset + limit),
            total: sorted.length
        };
    }

    private mapRow(row: any): SchoolStudentPaidChargeItem {
        const providerNetCents =
            row.charge_provider_net_amount_cents === undefined || row.charge_provider_net_amount_cents === null
                ? null
                : Number(row.charge_provider_net_amount_cents);

        return {
            id: row.charge_id,
            amount: row.charge_amount_cents / 100,
            amountCents: row.charge_amount_cents,
            discount: row.charge_discount_cents != null ? row.charge_discount_cents / 100 : null,
            discountCents: row.charge_discount_cents,
            discountReason: row.charge_discount_cents != null ? (row.charge_discount_reason ?? null) : null,
            netAmount: row.charge_net_amount_cents / 100,
            netAmountCents: row.charge_net_amount_cents,
            providerNetAmountCents: providerNetCents,
            providerNetAmount: providerNetCents !== null ? providerNetCents / 100 : null,
            description: formatSchoolChargeDescriptionForSchoolUi(
                row.charge_charge_type,
                row.charge_description,
                row.course_name
            ),
            dueDate: new Date(row.charge_due_date),
            paidAt: row.charge_paid_at ? new Date(row.charge_paid_at) : null,
            paymentMethod: this.normalizePaymentMethod(row.charge_payment_method),
            status: row.charge_status,
            statusDisplay: this.getStatusDisplay(row.charge_status as SchoolFinancialChargeStatus, new Date(row.charge_due_date)),
            course: {
                id: row.course_id,
                name: row.course_name
            },
            class: {
                id: row.class_id,
                label: row.class_label
            }
        };
    }

    private normalizePaymentMethod(
        raw: unknown
    ): 'PIX' | 'BOLETO' | 'MANUAL' | null {
        if (raw === 'PIX' || raw === 'BOLETO' || raw === 'MANUAL') {
            return raw;
        }
        return null;
    }

    private getStatusDisplay(status: SchoolFinancialChargeStatus, dueDate: Date): SchoolPaymentStatusDisplay {
        if (status === 'OPEN' || status === 'PENDING_SYNC') {
            if (isOpenChargeCalendarOverdue(new Date(dueDate))) return 'Atrasado';
            return 'Pendente';
        }
        const map: Record<SchoolFinancialChargeStatus, SchoolPaymentStatusDisplay> = {
            PENDING_SYNC: 'Pendente',
            OPEN: 'Pendente',
            OVERDUE: 'Atrasado',
            PAID: 'Pago',
            CANCELLED: 'Cancelado',
            FAILED: 'Falhou'
        };
        return map[status] ?? 'Pendente';
    }
}
