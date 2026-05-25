import type { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { AppError, ErrorCode } from '../../../shared/errors';
import { presentEnrollmentMonthlyTuition } from '../../presenters/enrollment-monthly-tuition.presenter';
import { resolveDiscountValidUntilMonthLabel } from '../../../shared/discount-valid-until-month';

export type GetMyEnrollmentByCourseInput = {
    ownerUserId: string;
    courseId: string;
    /** Quando há mais de uma matrícula no curso (ex.: dependentes), filtra por id. */
    enrollmentId?: string;
};

export type StudentEnrollmentResponsible = {
    id: string;
    fullName: string;
    cpf: string;
    email: string;
    phone: string;
};

export type StudentEnrollmentByCourseItem = {
    enrollmentId: string;
    enrolledAt: string;
    enrollmentActive: boolean;
    studentName: string;
    studentCpf: string | null;
    studentType: 'USER' | 'DEPENDENT';
    course: { id: string; name: string };
    class: { id: string; name: string };
    schedule: Array<{ day: string; start: string; end: string }>;
    school: {
        id: string;
        name: string;
        cnpj: string | null;
        /** Preenchido quando a escola não tem CNPJ cadastrado. */
        cpf: string | null;
    };
    responsible: StudentEnrollmentResponsible | null;
    tuitionExempt: boolean;
    tuitionExemptionType: string | null;
    monthlyTuitionAmount: number | null;
    monthlyTuitionNetAmount: number | null;
    discountAmount: number | null;
    discountMonths: number | null;
    discountValidUntilMonth: string | null;
    /** Dia do mês (1–31) para vencimento da mensalidade. */
    paymentDueDay: number;
};

export class GetMyEnrollmentByCourse {
    constructor(private readonly enrollments: EnrollmentRepository) {}

    async exec(input: GetMyEnrollmentByCourseInput): Promise<{ enrollments: StudentEnrollmentByCourseItem[] }> {
        const ownerUserId = input.ownerUserId?.trim();
        const courseId = input.courseId?.trim();
        if (!ownerUserId || !courseId) {
            throw AppError.notFound('Matrícula', { courseId });
        }

        if (!this.enrollments.findMyEnrollmentDetailsByCourseId) {
            throw AppError.notFound('Matrícula', { courseId });
        }

        let rows = await this.enrollments.findMyEnrollmentDetailsByCourseId(ownerUserId, courseId);
        const enrollmentId = input.enrollmentId?.trim();
        if (enrollmentId) {
            rows = rows.filter((row) => row.enrollmentId === enrollmentId);
        }

        if (rows.length === 0) {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_NOT_FOUND, { courseId, enrollmentId });
        }

        return {
            enrollments: rows.map((row) => this.mapRow(row))
        };
    }

    private mapRow(
        row: import('../../../ports/repositories/enrollment.repo').MyEnrollmentDetailByCourseRow
    ): StudentEnrollmentByCourseItem {
        const tuition = presentEnrollmentMonthlyTuition({
            tuitionExemptionType: row.tuitionExemptionType,
            fullAmountCents: row.fullAmountCents,
            paymentDueDay: row.paymentDueDay,
            discountCents: row.discountCents,
            discountMonths: row.discountMonths,
            courseMonthlyPriceCents: row.courseMonthlyPriceCents,
            classMonthlyPriceCents: row.classMonthlyPriceCents
        });

        const schoolCnpj = row.schoolCnpj?.trim() ? row.schoolCnpj.trim() : null;
        const responsible: StudentEnrollmentResponsible | null =
            row.studentType === 'DEPENDENT'
                ? {
                      id: row.ownerUserId,
                      fullName: row.ownerFullName,
                      cpf: row.ownerCpf,
                      email: row.ownerEmail,
                      phone: row.ownerPhone
                  }
                : null;

        return {
            enrollmentId: row.enrollmentId,
            enrolledAt: row.enrolledAt.toISOString(),
            enrollmentActive: row.status === 'ACTIVE',
            studentName: row.studentName,
            studentCpf: row.studentCpf,
            studentType: row.studentType,
            course: { id: row.courseId, name: row.courseName },
            class: { id: row.classId, name: row.className },
            schedule: row.schedule,
            school: {
                id: row.schoolId,
                name: row.schoolName,
                cnpj: schoolCnpj,
                cpf: schoolCnpj ? null : row.ownerCpf
            },
            responsible,
            tuitionExempt: tuition.tuitionExempt,
            tuitionExemptionType: tuition.tuitionExemptionType,
            monthlyTuitionAmount: tuition.monthlyTuitionAmount,
            monthlyTuitionNetAmount: tuition.monthlyTuitionNetAmount,
            discountAmount: tuition.discount,
            discountMonths: tuition.discountMonths,
            discountValidUntilMonth: resolveDiscountValidUntilMonthLabel(
                row.enrolledAt,
                tuition.discountMonths
            ),
            paymentDueDay: row.paymentDueDay ?? 10
        };
    }
}
