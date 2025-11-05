/**
 * Utilitários para manipulação e validação de datas
 */

import { AppError, ErrorCode } from '../../shared/errors';

/**
 * Normaliza uma string de data no formato YYYY-MM-DD para um objeto Date
 * Valida o formato e a validade da data
 * 
 * @param value - String de data no formato YYYY-MM-DD
 * @param fieldName - Nome do campo para mensagens de erro (opcional)
 * @returns Objeto Date normalizado
 * @throws AppError se a data for inválida
 */
export function normalizeDateString(value: string, fieldName = 'date'): Date {
    if (!value || typeof value !== 'string') {
        throw AppError.fromCode(ErrorCode.INVALID_DATE, {
            message: `Data inválida para ${fieldName}`,
            value
        });
    }

    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    
    if (!match) {
        throw AppError.fromCode(ErrorCode.INVALID_DATE, {
            message: `Formato de data inválido para ${fieldName}. Esperado: YYYY-MM-DD`,
            value: trimmed
        });
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
        Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw AppError.fromCode(ErrorCode.INVALID_DATE, {
            message: `Data inválida para ${fieldName}`,
            value: trimmed
        });
    }

    return date;
}

/**
 * Normaliza uma string de data opcional para Date ou null
 * 
 * @param value - String de data no formato YYYY-MM-DD ou null/undefined
 * @param fieldName - Nome do campo para mensagens de erro (opcional)
 * @returns Objeto Date ou null
 * @throws AppError se a data fornecida for inválida
 */
export function normalizeOptionalDateString(
    value: string | null | undefined,
    fieldName = 'date'
): Date | null {
    if (value === undefined || value === null) {
        return null;
    }

    return normalizeDateString(value, fieldName);
}

