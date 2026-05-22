import { z } from 'zod';
import { TUITION_EXEMPTION_TYPES } from '../../../domain/value-objects/tuition-exemption-type';

const tuitionExemptionTypeSchema = z.enum(TUITION_EXEMPTION_TYPES);

/** Optional tuition exemption fields (enrollment / enrollment request). */
export const enrollmentTuitionExemptionFields = {
    monthlyTuition: z.literal('EXEMPT').optional(),
    tuitionExemptionType: tuitionExemptionTypeSchema.optional()
};

export function refineEnrollmentTuitionExemption(
    data: {
        monthlyTuition?: 'EXEMPT';
        tuitionExemptionType?: z.infer<typeof tuitionExemptionTypeSchema>;
        discont?: number;
    },
    ctx: z.RefinementCtx
): void {
    const isExempt = data.monthlyTuition === 'EXEMPT';

    if (isExempt && !data.tuitionExemptionType) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tuitionExemptionType'],
            message:
                'tuitionExemptionType is required when monthlyTuition is EXEMPT (EMPLOYEE, RELATIVE, SCHOLARSHIP or NONPROFIT)'
        });
    }

    if (!isExempt && data.tuitionExemptionType) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['monthlyTuition'],
            message: 'monthlyTuition must be EXEMPT when tuitionExemptionType is provided'
        });
    }

    if (isExempt && data.discont !== undefined && data.discont !== null && data.discont > 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['discont'],
            message: 'Discount does not apply when monthlyTuition is EXEMPT'
        });
    }
}
