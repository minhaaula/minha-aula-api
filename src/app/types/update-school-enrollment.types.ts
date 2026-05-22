import type { TuitionExemptionType } from '../../domain/value-objects/tuition-exemption-type';

export interface UpdateSchoolEnrollmentInput {
    schoolId: string;
    courseId: string;
    classId: string;
    enrollmentId: string;
    paymentDueDay?: number;
    /** Define o dia de vencimento a partir da data (usa o dia do mês, UTC). */
    firstMonthlyPaymentDate?: string;
    discountCents?: number | null;
    discountMonths?: number | null;
    clearDiscount?: boolean;
    monthlyTuition?: 'EXEMPT';
    tuitionExemptionType?: TuitionExemptionType | null;
    /** Remove isenção e restaura mensalidade do curso/turma. */
    removeTuitionExemption?: boolean;
}

export interface UpdateSchoolEnrollmentOutput {
    id: string;
    courseClassId: string;
    status: string;
    paymentDueDay: number;
    fullAmountCents: number | null;
    discountCents: number | null;
    discountMonths: number | null;
    monthlyTuition: 'EXEMPT' | null;
    tuitionExemptionType: TuitionExemptionType | null;
    updatedAt: Date;
}
