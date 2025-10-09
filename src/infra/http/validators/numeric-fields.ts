import { z } from 'zod';

const ensureDigitLength = (
    digits: string,
    ctx: z.RefinementCtx,
    label: string,
    { min, max }: { min?: number; max: number }
) => {
    const length = digits.length;
    if ((min !== undefined && length < min) || length === 0 || length > max) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid ${label}`
        });
    }
};

export const phoneNumberSchema = () =>
    z.number().int().nonnegative().transform((value) => value.toString()).superRefine((digits, ctx) => {
        if (digits.length < 10 || digits.length > 15) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid phone' });
        }
    });

export const cpfNumberSchema = () =>
    z
        .number()
        .int()
        .nonnegative()
        .transform((value) => value.toString())
        .superRefine((digits, ctx) => ensureDigitLength(digits, ctx, 'CPF', { max: 11 }))
        .transform((digits) => digits.padStart(11, '0'));

export const cnpjNumberSchema = () =>
    z
        .number()
        .int()
        .nonnegative()
        .transform((value) => value.toString())
        .superRefine((digits, ctx) => ensureDigitLength(digits, ctx, 'CNPJ', { max: 14 }))
        .transform((digits) => digits.padStart(14, '0'));

export const zipCodeNumberSchema = () =>
    z
        .number()
        .int()
        .nonnegative()
        .transform((value) => value.toString())
        .superRefine((digits, ctx) => ensureDigitLength(digits, ctx, 'zip code', { max: 8 }))
        .transform((digits) => digits.padStart(8, '0'));

export const cpfOrCnpjNumberSchema = () =>
    z
        .number()
        .int()
        .nonnegative()
        .transform((value) => value.toString())
        .superRefine((digits, ctx) => {
            if (digits.length === 0 || digits.length > 14) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid CPF/CNPJ' });
            }
        })
        .transform((digits) => {
            if (digits.length <= 11) {
                return digits.padStart(11, '0');
            }
            return digits.padStart(14, '0');
        });
