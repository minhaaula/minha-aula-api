import { z } from 'zod';
import {
    cnpjNumberSchema,
    cpfNumberSchema,
    phoneNumberSchema,
    zipCodeNumberSchema
} from './numeric-fields';

export const addressSchema = z.object({
    street: z.string().trim().min(1),
    number: z.string().trim().min(1),
    complement: z.string().trim().min(1).optional().nullable(),
    district: z.string().trim().min(1).optional().nullable(),
    city: z.string().trim().min(1),
    state: z.string().trim().min(1),
    zipCode: zipCodeNumberSchema()
});

export const createSchoolSchema = z.object({
    name: z.string().trim().min(3),
    email: z.string().trim().email(),
    phone: phoneNumberSchema(),
    cnpj: cnpjNumberSchema(),
    ownerName: z.string().trim().min(3),
    ownerCpf: cpfNumberSchema(),
    ownerEmail: z.string().trim().email(),
    ownerPassword: z.string().min(8),
    addresses: z.array(addressSchema).optional()
});

export const updateSchoolSchema = z.object({
    name: z.string().trim().min(3).optional(),
    email: z.string().trim().email().optional(),
    phone: phoneNumberSchema().optional(),
    cnpj: cnpjNumberSchema().optional(),
    ownerName: z.string().trim().min(3).nullable().optional(),
    ownerCpf: cpfNumberSchema().nullable().optional(),
    ownerEmail: z.string().trim().email().nullable().optional(),
    ownerUserId: z.string().trim().min(1).nullable().optional(),
    ownerPassword: z.string().min(8).nullable().optional(),
    addresses: z.array(addressSchema).optional()
});

export const courseCategorySchema = z.object({
    categoryId: z.string().trim().min(1),
    subcategoryIds: z.array(z.string().trim().min(1)).optional()
});

export const createCourseSchema = z.object({
    name: z.string().min(3),
    description: z.string().min(1).optional(),
    categories: z.array(courseCategorySchema).optional()
});

export const updateCourseSchema = z.object({
    name: z.string().trim().min(3).optional(),
    description: z.string().trim().min(1).optional().nullable(),
    categories: z.array(courseCategorySchema).optional()
});

export const createCourseClassSchema = z.object({
    label: z.string().min(1),
    shift: z.string().min(1).optional(),
    capacity: z.number().int().positive().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional()
}).superRefine((value, ctx) => {
    const { startsAt, endsAt } = value;
    if (!startsAt || !endsAt) return;

    const starts = new Date(startsAt);
    const ends = new Date(endsAt);

    let hasStartIssue = false;
    let hasEndIssue = false;

    if (Number.isNaN(starts.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startsAt'], message: 'Invalid start date' });
        hasStartIssue = true;
    }
    if (Number.isNaN(ends.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'Invalid end date' });
        hasEndIssue = true;
    }
    if (!hasStartIssue && !hasEndIssue && ends <= starts) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'End date must be after start date' });
    }
});

export const scheduleClassSessionSchema = z.object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    location: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional()
});

export const listClassSessionsQuerySchema = z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    courseClassId: z.string().uuid().optional()
});

export const courseIdParamSchema = z.object({
    courseId: z.string().uuid()
});

export const courseClassParamsSchema = z.object({
    courseId: z.string().uuid(),
    classId: z.string().uuid()
});

export const classSessionsParamsSchema = z.object({
    courseId: z.string().uuid(),
    classId: z.string().uuid()
});

export const classSessionsDateRangeSchema = z.object({
    from: z.string().datetime(),
    to: z.string().datetime()
});

export const sessionIdParamsSchema = z.object({
    sessionId: z.string().uuid()
});

export const assignSchoolPlanSchema = z.object({
    planId: z.string().uuid(),
    notes: z.string().trim().min(1).optional()
});
