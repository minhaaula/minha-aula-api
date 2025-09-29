import { describe, expect, it } from 'vitest';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';

describe('PostalAddress value object', () => {
    it('normalizes zip code and trims optional fields', () => {
        const address = PostalAddress.create({
            street: '  Rua das Flores  ',
            number: ' 123 ',
            complement: '  Apto 5  ',
            district: ' Centro ',
            city: ' São Paulo ',
            state: ' SP ',
            zipCode: '01234-000'
        });

        expect(address.street).toBe('Rua das Flores');
        expect(address.number).toBe('123');
        expect(address.complement).toBe('Apto 5');
        expect(address.district).toBe('Centro');
        expect(address.city).toBe('São Paulo');
        expect(address.state).toBe('SP');
        expect(address.zipCode).toBe('01234000');
    });

    it('rejects invalid zip codes', () => {
        expect(() => PostalAddress.create({
            street: 'Rua X',
            number: '10',
            city: 'Cidade',
            state: 'ST',
            zipCode: '1234'
        })).toThrow('Invalid zip code');
    });
});
