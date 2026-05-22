import { z } from 'zod';
import { phoneNumberSchema } from './numeric-fields';
import { addressSchema } from './common-schemas';
import { optionalGenderSchema } from './gender-schemas';

// Re-export para compatibilidade
export { addressSchema };

export const requestStudentProfileUpdateOtpSchema = z.object({
    phone: phoneNumberSchema().optional()
});

export const verifyStudentProfileUpdateOtpSchema = z.object({
    challengeId: z.string().uuid(),
    code: z.string().trim().regex(/^\d{4,8}$/)
});

export const updateStudentProfileSchema = z.object({
    profileUpdateVerificationToken: z
        .string()
        .min(1, 'Confirme o WhatsApp antes de salvar as alterações do perfil'),
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

