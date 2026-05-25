import { z } from 'zod';
import { zipCodeNumberSchema } from './numeric-fields';

/** Normaliza birthDate para YYYY-MM-DD (aceita ISO e DD/MM/YYYY do front). */
export const optionalBirthDateSchema = z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) {
        return undefined;
    }
    if (typeof val !== 'string') {
        return val;
    }
    const trimmed = val.trim();
    const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoPrefix) {
        return isoPrefix[1];
    }
    const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) {
        return `${br[3]}-${br[2]}-${br[1]}`;
    }
    return trimmed;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate inválido — use YYYY-MM-DD').optional());

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
