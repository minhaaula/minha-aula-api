import { z } from 'zod';
import { cpfOrCnpjNumberSchema } from './numeric-fields';

/** JSON costuma mandar `banco` como string ("001"); Asaas espera código numérico. */
const optionalBankCodeSchema = z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    return val;
}, z.coerce.number().int().positive().optional());

export const createBankAccountSchema = z.object({
    bankName: z.string().trim().min(1),
    banco: optionalBankCodeSchema,
    bankAgency: z.string().trim().min(1).max(20),
    digitoAgencia: z.string().trim().max(2).optional(),
    bankAccount: z.string().trim().min(1).max(20),
    digitoConta: z.string().trim().max(2).optional(),
    bankAccountType: z.enum(['CORRENTE', 'POUPANCA']),
    /** Opcional: se omitido, usa CNPJ da escola (PJ) ou CPF do responsável (PF) cadastrados no perfil. */
    bankAccountHolderDocument: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : val),
        cpfOrCnpjNumberSchema().optional()
    ),
    PIX: z.string().trim().max(191).optional(),
    otpChallengeId: z.string().uuid()
});

export const updateBankAccountSchema = z.object({
    bankName: z.string().trim().min(1).optional(),
    banco: optionalBankCodeSchema,
    bankAgency: z.string().trim().min(1).max(20).optional(),
    digitoAgencia: z.string().trim().max(2).optional(),
    bankAccount: z.string().trim().min(1).max(20).optional(),
    digitoConta: z.string().trim().max(2).optional(),
    bankAccountType: z.enum(['CORRENTE', 'POUPANCA']).optional(),
    bankAccountHolderDocument: cpfOrCnpjNumberSchema().optional(),
    PIX: z.string().trim().max(191).optional(),
    isActive: z.boolean().optional(),
    otpChallengeId: z.string().uuid()
});
