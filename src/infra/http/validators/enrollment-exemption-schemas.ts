import { z } from 'zod';
import { TUITION_EXEMPTION_TYPES } from '../../../domain/value-objects/tuition-exemption-type';

const tuitionExemptionTypeSchema = z.enum(TUITION_EXEMPTION_TYPES);

/** Campos opcionais de isenção de mensalidade (matrícula / pedido de matrícula). */
export const enrollmentTuitionExemptionFields = {
    tuitionExempt: z.boolean().optional(),
    tuitionExemptionType: tuitionExemptionTypeSchema.optional()
};

export function refineEnrollmentTuitionExemption(
    data: {
        tuitionExempt?: boolean;
        tuitionExemptionType?: z.infer<typeof tuitionExemptionTypeSchema>;
        discont?: number;
    },
    ctx: z.RefinementCtx
): void {
    const isExempt = data.tuitionExempt === true;

    if (isExempt && !data.tuitionExemptionType) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tuitionExemptionType'],
            message:
                'tuitionExemptionType is required when tuitionExempt is true (EMPLOYEE, RELATIVE, SCHOLARSHIP or NONPROFIT)'
        });
    }

    if (!isExempt && data.tuitionExemptionType) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tuitionExempt'],
            message: 'tuitionExempt must be true when tuitionExemptionType is provided'
        });
    }

    if (isExempt && data.discont !== undefined && data.discont !== null && data.discont > 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['discont'],
            message: 'Discount does not apply when tuitionExempt is true'
        });
    }
}
