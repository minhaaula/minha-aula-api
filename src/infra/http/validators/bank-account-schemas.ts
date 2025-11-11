import { z } from 'zod';
import { cpfNumberSchema, cnpjNumberSchema } from './numeric-fields';

export const createBankAccountSchema = z.object({
    bankName: z.string().trim().min(1),
    bankAgency: z.string().trim().min(1).max(20),
    bankAccount: z.string().trim().min(1).max(20),
    bankAccountType: z.enum(['CORRENTE', 'POUPANCA']),
    bankAccountHolderDocument: z.union([cpfNumberSchema(), cnpjNumberSchema()])
});

export const updateBankAccountSchema = z.object({
    bankName: z.string().trim().min(1).optional(),
    bankAgency: z.string().trim().min(1).max(20).optional(),
    bankAccount: z.string().trim().min(1).max(20).optional(),
    bankAccountType: z.enum(['CORRENTE', 'POUPANCA']).optional(),
    bankAccountHolderDocument: z.union([cpfNumberSchema(), cnpjNumberSchema()]).optional(),
    isActive: z.boolean().optional()
});

