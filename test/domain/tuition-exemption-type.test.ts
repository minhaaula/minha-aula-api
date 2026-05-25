import { describe, expect, it } from 'vitest';
import {
    getTuitionExemptionTypeLabel,
    isTuitionExemptionType,
    listTuitionExemptionTypes,
    parseTuitionExemptionType,
    TUITION_EXEMPTION_TYPES
} from '../../src/domain/value-objects/tuition-exemption-type';

describe('tuition-exemption-type', () => {
    it('exposes all exemption types in English', () => {
        expect(TUITION_EXEMPTION_TYPES).toEqual(['EMPLOYEE', 'RELATIVE', 'SCHOLARSHIP', 'NONPROFIT']);
    });

    it.each(TUITION_EXEMPTION_TYPES)('recognizes %s', (type) => {
        expect(isTuitionExemptionType(type)).toBe(true);
        expect(parseTuitionExemptionType(type)).toBe(type);
        expect(parseTuitionExemptionType(type.toLowerCase())).toBe(type);
    });

    it('returns null for empty or unknown values', () => {
        expect(parseTuitionExemptionType(null)).toBeNull();
        expect(parseTuitionExemptionType('')).toBeNull();
        expect(parseTuitionExemptionType('FUNCIONARIO')).toBeNull();
        expect(isTuitionExemptionType('ISENTO')).toBe(false);
    });

    it('lists all types with Portuguese labels', () => {
        const items = listTuitionExemptionTypes();
        expect(items).toHaveLength(4);
        expect(items).toEqual([
            { value: 'EMPLOYEE', label: 'Funcionário' },
            { value: 'RELATIVE', label: 'Parente' },
            { value: 'SCHOLARSHIP', label: 'Bolsa de estudos' },
            { value: 'NONPROFIT', label: 'Instituição sem fins lucrativos' }
        ]);
        expect(getTuitionExemptionTypeLabel('SCHOLARSHIP')).toBe('Bolsa de estudos');
        expect(getTuitionExemptionTypeLabel(null)).toBeNull();
    });
});
