import { z } from 'zod';
import { zipCodeNumberSchema } from './numeric-fields';

/**
 * Schema comum para endereço postal
 * Usado em múltiplos lugares: escolas, estudantes, registro de usuário
 */
export const addressSchema = z.object({
    street: z.string().trim().min(1),
    number: z.string().trim().min(1),
    complement: z.string().trim().optional().nullable(),
    district: z.string().trim().min(1).optional().nullable(),
    city: z.string().trim().min(1),
    state: z.string().trim().min(1),
    zipCode: zipCodeNumberSchema()
});
