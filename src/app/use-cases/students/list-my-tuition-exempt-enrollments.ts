import type { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import type { TuitionExemptionType } from '../../../domain/value-objects/tuition-exemption-type';
import { presentTuitionExemption } from '../../presenters/tuition-exemption.presenter';
import { getAppCalendarYmd } from '../../../shared/billing-due-date';

export type CurrentMonthInfo = {
    year: number;
    month: number;
};

export type TuitionExemptEnrollmentRecord = {
    enrollmentId: string;
    studentName: string;
    course: { id: string; name: string };
    class: { id: string; name: string };
    tuitionExempt: true;
    tuitionExemptionType: TuitionExemptionType;
    monthlyTuitionAmountCents: number | null;
    monthlyTuitionAmount: number | null;
};

export class ListMyTuitionExemptEnrollments {
    constructor(private readonly enrollments: EnrollmentRepository) {}

    async exec(input: { userId: string }): Promise<{
        currentMonth: CurrentMonthInfo;
        enrollments: TuitionExemptEnrollmentRecord[];
    }> {
        const userId = input.userId?.trim();
        const currentMonth = this.resolveCurrentMonth(new Date());

        if (!userId || !this.enrollments.findMyTuitionExemptEnrollments) {
            return { currentMonth, enrollments: [] };
        }

        const rows = await this.enrollments.findMyTuitionExemptEnrollments(userId);

        const enrollments: TuitionExemptEnrollmentRecord[] = rows.map((row) => {
            const exemption = presentTuitionExemption(row.tuitionExemptionType);
            const monthlyTuitionAmountCents = row.monthlyTuitionAmountCents;
            return {
                enrollmentId: row.enrollmentId,
                studentName: row.studentName,
                course: { id: row.courseId, name: row.courseName },
                class: { id: row.classId, name: row.className },
                tuitionExempt: true,
                tuitionExemptionType: exemption.tuitionExemptionType!,
                monthlyTuitionAmountCents,
                monthlyTuitionAmount:
                    monthlyTuitionAmountCents != null ? monthlyTuitionAmountCents / 100 : null
            };
        });

        return { currentMonth, enrollments };
    }

    private resolveCurrentMonth(now: Date): CurrentMonthInfo {
        const { year, month } = getAppCalendarYmd(now);
        return { year, month };
    }
}
