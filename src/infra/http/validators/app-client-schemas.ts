import { z } from 'zod';

/** Metadados do app mobile enviados no login do aluno (todos obrigatórios quando o bloco é enviado). */
export const loginAppClientSchema = z
    .object({
        platform: z.enum(['ANDROID', 'IOS']),
        appVersion: z.string().trim().min(1).max(32),
        osVersion: z.string().trim().min(1).max(64),
        notificationsEnabled: z.boolean()
    })
    .optional();

export type LoginAppClientInput = z.infer<typeof loginAppClientSchema>;
