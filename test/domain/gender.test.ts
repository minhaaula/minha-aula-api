import { describe, expect, it } from 'vitest';
import { listGenders, parseGender } from '../../src/domain/value-objects/gender';
import { User } from '../../src/domain/entities/user';
import { Dependent } from '../../src/domain/entities/dependent';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';

describe('gender', () => {
    it('lists gender options with labels', () => {
        expect(listGenders()).toEqual([
            { value: 'MALE', label: 'Masculino' },
            { value: 'FEMALE', label: 'Feminino' }
        ]);
    });

    it('stores optional gender on user and dependent', () => {
        const user = User.create({
            id: 'u1',
            fullName: 'Aluno',
            birthDate: new Date('2000-01-01'),
            email: Email.create('a@b.com'),
            phone: '11999999999',
            cpf: '12345678909',
            address: PostalAddress.create({
                street: 'Rua',
                number: '1',
                city: 'SP',
                state: 'SP',
                zipCode: '01000000'
            }),
            persona: 'STUDENT',
            passwordHash: 'hash',
            gender: 'FEMALE'
        });
        expect(user.gender).toBe('FEMALE');

        const dep = Dependent.create({
            id: 'd1',
            userId: 'u1',
            fullName: 'Dep',
            gender: 'MALE'
        });
        expect(dep.gender).toBe('MALE');
        expect(parseGender('male')).toBe('MALE');
        expect(parseGender('OTHER')).toBeNull();
    });
});
