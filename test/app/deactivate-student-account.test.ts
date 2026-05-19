import { describe, expect, it } from 'vitest';
import { DeactivateStudentAccount } from '../../src/app/use-cases/deactivate-student-account';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';

class InMemoryUserRepository implements UserRepository {
    private readonly users = new Map<string, User>();
    readonly deactivated: Array<{ userId: string; motivo: string; descricao: string }> = [];

    async findByEmail(): Promise<User | null> {
        return null;
    }

    async findByCpf(): Promise<User | null> {
        return null;
    }

    async findById(id: string): Promise<User | null> {
        return this.users.get(id) ?? null;
    }

    async findByPersona(): Promise<User[]> {
        return Array.from(this.users.values());
    }

    async save(user: User): Promise<void> {
        this.users.set(user.id, user);
    }

    async deactivateAccount(userId: string, motivo: string, descricao: string): Promise<void> {
        if (!this.users.has(userId)) {
            throw new Error('repo context lost');
        }
        this.deactivated.push({ userId, motivo, descricao });
    }

    seed(user: User) {
        this.users.set(user.id, user);
    }
}

const makeStudent = (id = 'user-1') =>
    User.create({
        id,
        fullName: 'Aluno Teste',
        birthDate: new Date('1990-01-01'),
        email: Email.create('aluno@example.com'),
        phone: '11999999999',
        cpf: '12345678909',
        address: PostalAddress.create({
            street: 'Rua A',
            number: '1',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234000'
        }),
        persona: UserPersonaEnum.STUDENT,
        passwordHash: 'hash',
        active: true
    });

describe('DeactivateStudentAccount use case', () => {
    it('deactivates student account via repository method with correct context', async () => {
        const users = new InMemoryUserRepository();
        users.seed(makeStudent());

        const useCase = new DeactivateStudentAccount(users);
        const result = await useCase.exec({
            userId: 'user-1',
            motivo: 'Não uso mais',
            descricao: 'Solicitei exclusão'
        });

        expect(result).toEqual({ success: true });
        expect(users.deactivated).toEqual([
            { userId: 'user-1', motivo: 'Não uso mais', descricao: 'Solicitei exclusão' }
        ]);
    });
});
