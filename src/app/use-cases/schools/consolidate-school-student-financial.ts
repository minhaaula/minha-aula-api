import { AppDataSource } from '../../../infra/db/typeorm/datasource';
import { EnrollmentOrm } from '../../../infra/db/typeorm/entities/enrollment.orm';
import { SchoolFinancialChargeOrm } from '../../../infra/db/typeorm/entities/school-financial-charge.orm';
import { SchoolFinancialChargeStatus } from '../../../domain/entities/school-financial-charge';
import { isOpenChargeCalendarOverdue } from '../../../shared/billing-due-date';

export interface ConsolidateSchoolStudentFinancialInput {
    schoolId: string;
    studentId: string;
}

/** Totais em centavos (valor líquido da cobrança). */
export interface ConsolidateSchoolStudentFinancialOutput {
    pendingTotalCents: number;
    paidTotalCents: number;
    overdueTotalCents: number;
    /** Soma de todas as cobranças do aluno na escola (inclui canceladas). */
    grandTotalCents: number;
}

/**
 * Agrega valores por faixa (pendente / pago / atrasado) alinhado à listagem de mensalidades da escola.
 * Exportado para testes unitários.
 */
export function aggregateStudentChargeAmounts(
    rows: Array<{ netAmountCents: number; status: SchoolFinancialChargeStatus; dueDate: Date }>
): ConsolidateSchoolStudentFinancialOutput {
    let pendingTotalCents = 0;
    let paidTotalCents = 0;
    let overdueTotalCents = 0;
    let grandTotalCents = 0;

    for (const row of rows) {
        const net = Number(row.netAmountCents) || 0;
        const status = row.status;
        const dueDate = row.dueDate instanceof Date ? row.dueDate : new Date(row.dueDate);

        grandTotalCents += net;

        if (status === 'PAID') {
            paidTotalCents += net;
            continue;
        }

        if (status === 'CANCELLED') {
            continue;
        }

        const openLikeOverdue =
            status === 'OVERDUE' ||
            ((status === 'OPEN' || status === 'PENDING_SYNC' || status === 'FAILED') && isOpenChargeCalendarOverdue(dueDate));

        if (openLikeOverdue) {
            overdueTotalCents += net;
            continue;
        }

        if (status === 'OPEN' || status === 'PENDING_SYNC' || status === 'FAILED') {
            pendingTotalCents += net;
        }
    }

    return {
        pendingTotalCents,
        paidTotalCents,
        overdueTotalCents,
        grandTotalCents
    };
}

export class ConsolidateSchoolStudentFinancial {
    async exec(input: ConsolidateSchoolStudentFinancialInput): Promise<ConsolidateSchoolStudentFinancialOutput | null> {
        const schoolId = input.schoolId?.trim();
        const studentId = input.studentId?.trim();

        if (!schoolId || !studentId) {
            return null;
        }

        const hasEnrollment = await this.checkStudentEnrollmentInSchool(schoolId, studentId);
        if (!hasEnrollment) {
            return null;
        }

        const chargeRepo = AppDataSource.getRepository(SchoolFinancialChargeOrm);
        const qb = chargeRepo
            .createQueryBuilder('charge')
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('(charge.studentUserId = :studentId OR charge.dependentId = :studentId)', { studentId })
            .select([
                'charge.netAmountCents AS net_amount_cents',
                'charge.status AS status',
                'charge.dueDate AS due_date'
            ]);

        const raw = await qb.getRawMany();

        const rows = raw.map((row: { net_amount_cents: number; status: string; due_date: Date | string }) => ({
            netAmountCents: row.net_amount_cents,
            status: row.status as SchoolFinancialChargeStatus,
            dueDate: row.due_date instanceof Date ? row.due_date : new Date(row.due_date)
        }));

        return aggregateStudentChargeAmounts(rows);
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
}
