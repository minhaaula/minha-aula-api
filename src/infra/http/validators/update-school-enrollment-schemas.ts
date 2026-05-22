import { z } from 'zod';
import {
    enrollmentTuitionExemptionFields,
    refineEnrollmentTuitionExemption
} from './enrollment-exemption-schemas';

export const updateSchoolEnrollmentSchema = z
    .object({
        paymentDueDay: z.coerce.number().int().min(1).max(31).optional(),
        firstMonthlyPaymentDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
            .optional(),
        discountCents: z.number().int().min(0).nullable().optional(),
        discountMonths: z.number().int().min(1).nullable().optional(),
        clearDiscount: z.boolean().optional(),
        removeTuitionExemption: z.literal(true).optional(),
        ...enrollmentTuitionExemptionFields
    })
    .superRefine((data, ctx) => {
        if (data.clearDiscount && (data.discountCents != null || data.discountMonths != null)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['clearDiscount'],
                message: 'Use clearDiscount ou discountCents/discountMonths, não ambos'
            });
        }

        if (!data.clearDiscount && data.discountCents != null && data.discountCents > 0) {
            if (!data.discountMonths || data.discountMonths < 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['discountMonths'],
                    message: 'discountMonths is required when discountCents > 0'
                });
            }
        }

        refineEnrollmentTuitionExemption(
            {
                monthlyTuition: data.monthlyTuition,
                tuitionExemptionType: data.tuitionExemptionType,
                discont:
                    data.discountCents != null && data.discountCents > 0
                        ? data.discountCents / 100
                        : undefined
            },
            ctx
        );

        if (data.removeTuitionExemption && data.monthlyTuition === 'EXEMPT') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['removeTuitionExemption'],
                message: 'Não use removeTuitionExemption junto com monthlyTuition EXEMPT'
            });
        }
    });
