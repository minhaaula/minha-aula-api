import { describe, expect, it } from 'vitest';
import { RegisterUser } from '../../src/app/use-cases/auth/register-user';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { PasswordHasherPort } from '../../src/ports/providers/password-hasher.port';
import type { TokenProviderPort } from '../../src/ports/providers/token-provider.port';
import { AppError, ErrorCode } from '../../src/shared/errors';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';

class InMemoryUserRepository implements UserRepository {
    async findByEmail() {
        return null;
    }
    async findByCpf() {
        return null;
    }
    async findById() {
        return null;
    }
    async findByPersona() {
        return [];
    }
    async save() {}
    async isDeletedByAdmin() {
        return false;
    }
}

class FakeHasher implements PasswordHasherPort {
    async hash() {
        return 'hash';
    }
    async compare() {
        return true;
    }
}

class FakeTokenProvider implements TokenProviderPort {
    async sign() {
        return 'token';
    }
    async verify() {
        return { typ: 'signup_phone', ph: '+5511999999999' };
    }
}

const baseInput = {
    fullName: 'João Menor',
    birthDate: '2010-05-15',
    email: 'menor@example.com',
    phone: '11999999999',
    cpf: '52998224725',
    address: {
        street: 'Rua A',
        number: '1',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310100'
    },
    persona: UserPersonaEnum.STUDENT,
    password: 'senha1234',
    phoneVerificationToken: 'verified-token'
};

describe('RegisterUser', () => {
    it('rejeita cadastro de aluno menor de 18 anos', async () => {
        const useCase = new RegisterUser(
            new InMemoryUserRepository(),
            new FakeHasher(),
            new FakeTokenProvider()
        );

        await expect(useCase.exec(baseInput)).rejects.toMatchObject({
            code: ErrorCode.STUDENT_UNDERAGE_NOT_ALLOWED
        });
    });

    it('permite cadastro de aluno com 18 anos ou mais', async () => {
        const useCase = new RegisterUser(
            new InMemoryUserRepository(),
            new FakeHasher(),
            new FakeTokenProvider()
        );

        const result = await useCase.exec({
            ...baseInput,
            fullName: 'Maria Adulta',
            birthDate: '2000-01-15',
            email: 'adulta@example.com',
            cpf: '39053344705'
        });

        expect(result.persona).toBe(UserPersonaEnum.STUDENT);
    });
});
