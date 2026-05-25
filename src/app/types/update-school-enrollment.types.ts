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
    /** `true` = isentar; `false` = voltar a pagante (restaura valor do curso/turma). */
    tuitionExempt?: boolean;
    tuitionExemptionType?: TuitionExemptionType | null;
}

export interface UpdateSchoolEnrollmentOutput {
    id: string;
    courseClassId: string;
    status: string;
    paymentDueDay: number;
    fullAmountCents: number | null;
    discountCents: number | null;
    discountMonths: number | null;
    tuitionExempt: boolean;
    tuitionExemptionType: TuitionExemptionType | null;
    updatedAt: Date;
}
