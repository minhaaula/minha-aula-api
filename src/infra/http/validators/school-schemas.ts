import { z } from 'zod';
import {
    cnpjNumberSchema,
    cpfNumberSchema,
    phoneNumberSchema
} from './numeric-fields';
import { addressSchema } from './common-schemas';

// Re-export para compatibilidade
export { addressSchema };

export const createSchoolSchema = z.object({
    name: z.string().trim().min(3),
    email: z.string().trim().email(),
    phone: phoneNumberSchema(),
    cnpj: cnpjNumberSchema().optional().nullable(),
    incomeValue: z.number().int().positive().optional(),
    ownerName: z.string().trim().min(3),
    ownerCpf: cpfNumberSchema(),
    ownerEmail: z.string().trim().email(),
    ownerWhatsapp: phoneNumberSchema(),
    ownerWhatsappVerificationToken: z.string().trim().min(10),
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
    ownerWhatsapp: z.union([z.null(), phoneNumberSchema()]).optional(),
    ownerUserId: z.string().trim().min(1).nullable().optional(),
    ownerPassword: z.string().min(8).nullable().optional(),
    incomeValue: z.number().int().positive().optional(),
    addresses: z.array(addressSchema).optional(),
    links: z.object({
        facebook: z.string().trim().nullable().optional(),
        instagram: z.string().trim().nullable().optional(),
        tiktok: z.string().trim().nullable().optional(),
        youtube: z.string().trim().nullable().optional(),
        site: z.string().trim().nullable().optional()
    }).optional()
});

export const courseCategorySchema = z.object({
    categoryId: z.string().trim().min(1),
    subcategoryIds: z.array(z.string().trim().min(1)).optional()
});

export const createCourseSchema = z.object({
    name: z.string().min(3),
    description: z.string().min(1).optional(),
    categories: z.array(courseCategorySchema).optional(),
    monthlyPriceCents: z.number().int().nonnegative().nullable().optional()
});

export const updateCourseSchema = z.object({
    name: z.string().trim().min(3).optional(),
    description: z.string().trim().min(1).optional().nullable(),
    categories: z.array(courseCategorySchema).optional()
});

const classScheduleSchema = z.object({
    day: z.string().trim().min(1, 'Informe o dia da semana'),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe o horário inicial no formato HH:MM'),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe o horário final no formato HH:MM')
}).superRefine((value, ctx) => {
    const [startHours, startMinutes] = value.start.split(':').map((part) => Number(part));
    const [endHours, endMinutes] = value.end.split(':').map((part) => Number(part));

    if ((endHours * 60 + endMinutes) <= (startHours * 60 + startMinutes)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end'], message: 'Horário final deve ser após o inicial' });
    }
});

export const createCourseClassSchema = z.object({
    label: z.string().min(1),
    capacity: z.number().int().positive().optional(),
    monthlyPriceCents: z.number().int().nonnegative().nullable().optional(),
    classType: z.enum(['PRESENCIAL', 'ONLINE']).optional(),
    classes: z.array(classScheduleSchema).min(1, 'Informe pelo menos um horário padrão')
});

export const updateCourseClassSchema = z.object({
    label: z.string().min(1).optional(),
    capacity: z.union([z.number().int().positive(), z.null()]).optional(),
    monthlyPriceCents: z.union([z.number().int().nonnegative(), z.null()]).optional(),
    classType: z.enum(['PRESENCIAL', 'ONLINE']).optional(),
    classes: z.array(classScheduleSchema).min(1, 'Informe pelo menos um horário padrão').optional()
});

export const listCourseClassesQuerySchema = z.object({
    courseId: z.any().optional()
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

/** Curso + turma + matrícula (desmatrícula). */
export const courseClassEnrollmentParamsSchema = z.object({
    courseId: z.string().uuid(),
    classId: z.string().uuid(),
    enrollmentId: z.string().uuid()
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
    notes: z.string().trim().min(1).optional(),
    couponCode: z.string().trim().min(3).max(50).optional().nullable()
});

export const issuePlanInvoiceSchema = z.object({
    dueDate: z.string().datetime().optional(),
    description: z.string().trim().min(1).optional(),
    couponCode: z.string().trim().min(3).max(50).optional().nullable(),
    /** Se true, emite invoice do plano via PIX ao invés de boleto. */
    generatePix: z.boolean().optional()
});
