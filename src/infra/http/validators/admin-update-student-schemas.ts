import { z } from 'zod';
import { phoneNumberSchema, cpfNumberSchema } from './numeric-fields';
import { addressSchema } from './common-schemas';
import { optionalGenderSchema } from './gender-schemas';

/** Campos editáveis pelo admin (titular ou dependente). */
export const adminUpdateStudentSchema = z.object({
    fullName: z.string().trim().min(3).optional(),
    email: z.string().trim().email().optional(),
    /** WhatsApp / telefone (somente titular). */
    phone: phoneNumberSchema().optional(),
    cpf: cpfNumberSchema().optional().nullable(),
    birthDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
        .optional()
        .nullable(),
    address: addressSchema.optional(),
    gender: optionalGenderSchema,
    relationship: z.string().trim().min(1).optional().nullable()
});
