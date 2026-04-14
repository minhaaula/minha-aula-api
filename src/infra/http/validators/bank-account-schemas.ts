import { z } from 'zod';
import { cpfNumberSchema, cnpjNumberSchema } from './numeric-fields';

export const createBankAccountSchema = z.object({
    bankName: z.string().trim().min(1),
    banco: z.number().int().positive().optional(),
    bankAgency: z.string().trim().min(1).max(20),
    digitoAgencia: z.string().trim().max(2).optional(),
    bankAccount: z.string().trim().min(1).max(20),
    digitoConta: z.string().trim().max(2).optional(),
    bankAccountType: z.enum(['CORRENTE', 'POUPANCA']),
    bankAccountHolderDocument: z.union([cpfNumberSchema(), cnpjNumberSchema()]),
    PIX: z.string().trim().max(191).optional(),
    otpChallengeId: z.string().uuid()
});

export const updateBankAccountSchema = z.object({
    bankName: z.string().trim().min(1).optional(),
    banco: z.number().int().positive().optional(),
    bankAgency: z.string().trim().min(1).max(20).optional(),
    digitoAgencia: z.string().trim().max(2).optional(),
    bankAccount: z.string().trim().min(1).max(20).optional(),
    digitoConta: z.string().trim().max(2).optional(),
    bankAccountType: z.enum(['CORRENTE', 'POUPANCA']).optional(),
    bankAccountHolderDocument: z.union([cpfNumberSchema(), cnpjNumberSchema()]).optional(),
    PIX: z.string().trim().max(191).optional(),
    isActive: z.boolean().optional(),
    otpChallengeId: z.string().uuid()
});
