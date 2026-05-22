import { z } from 'zod';
import { phoneNumberSchema } from './numeric-fields';
import { addressSchema } from './common-schemas';
import { optionalGenderSchema } from './gender-schemas';

// Re-export para compatibilidade
export { addressSchema };

export const updateStudentProfileSchema = z.object({
    fullName: z.string().trim().min(3).optional(),
    email: z.string().trim().email().optional(),
    phone: phoneNumberSchema().optional(),
    address: addressSchema.optional(),
    gender: optionalGenderSchema
});

export const deactivateStudentAccountSchema = z.object({
    motivo: z.string().trim().min(1, 'O motivo é obrigatório'),
    descricao: z.string().trim()
});

