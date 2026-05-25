import { z } from 'zod';
import { TUITION_EXEMPTION_TYPES } from '../../../domain/value-objects/tuition-exemption-type';

const tuitionExemptionTypeSchema = z.enum(TUITION_EXEMPTION_TYPES);

/** Data YYYY-MM-DD opcional; string vazia do front vira `undefined`. */
export const optionalFirstMonthlyPaymentDateSchema = z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
        .optional()
);

/** Obrigatório apenas quando `tuitionExempt` não é true (pedido de matrícula / matrícula nova). */
export function refineFirstMonthlyPaymentDateUnlessExempt(
    data: { tuitionExempt?: boolean; firstMonthlyPaymentDate?: string },
    ctx: z.RefinementCtx
): void {
    if (data.tuitionExempt === true) {
        return;
    }
    if (!data.firstMonthlyPaymentDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['firstMonthlyPaymentDate'],
            message:
                'firstMonthlyPaymentDate é obrigatório quando a matrícula não é isenta (tuitionExempt true dispensa o campo)'
        });
    }
}

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
