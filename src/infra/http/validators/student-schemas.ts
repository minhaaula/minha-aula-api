import { z } from 'zod';
import { phoneNumberSchema, zipCodeNumberSchema } from './numeric-fields';

export const addressSchema = z.object({
    street: z.string().trim().min(1),
    number: z.string().trim().min(1),
    complement: z.string().trim().optional().nullable(),
    district: z.string().trim().min(1).optional().nullable(),
    city: z.string().trim().min(1),
    state: z.string().trim().min(1),
    zipCode: zipCodeNumberSchema()
});

export const updateStudentProfileSchema = z.object({
    fullName: z.string().trim().min(3).optional(),
    email: z.string().trim().email().optional(),
    phone: phoneNumberSchema().optional(),
    address: addressSchema.optional()
});

