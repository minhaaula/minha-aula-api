import { z } from 'zod';
import { phoneNumberSchema } from './numeric-fields';
import { addressSchema } from './common-schemas';

// Re-export para compatibilidade
export { addressSchema };

export const updateStudentProfileSchema = z.object({
    fullName: z.string().trim().min(3).optional(),
    email: z.string().trim().email().optional(),
    phone: phoneNumberSchema().optional(),
    address: addressSchema.optional()
});

