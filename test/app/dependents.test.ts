import { describe, expect, it } from 'vitest';
import { AddDependent } from '../../src/app/use-cases/add-dependent';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { Dependent } from '../../src/domain/entities/dependent';

class InMemoryUserRepository implements UserRepository {
    private readonly users = new Map<string, User>();

    async findByEmail(): Promise<User | null> {
        return null;
    }

    async findByCpf(): Promise<User | null> {
        return null;
    }

    async findById(id: string): Promise<User | null> {
        return this.users.get(id) ?? null;
    }

    async save(user: User): Promise<void> {
        this.users.set(user.id, user);
    }

    seed(user: User) {
        this.users.set(user.id, user);
    }
}

class InMemoryDependentRepository implements DependentRepository {
    private readonly dependents = new Map<string, Dependent>();

    async findById(id: string): Promise<Dependent | null> {
        return this.dependents.get(id) ?? null;
    }

    async findByUserAndFullName(userId: string, fullName: string): Promise<Dependent | null> {
        return Array.from(this.dependents.values()).find((dep) => dep.userId === userId && dep.fullName === fullName.trim()) ?? null;
    }

    async save(dependent: Dependent): Promise<void> {
        this.dependents.set(dependent.id, dependent);
    }

    seed(dependent: Dependent) {
        this.dependents.set(dependent.id, dependent);
    }
}

const makeUser = () => User.create({
    id: 'user-1',
    fullName: 'Fulano de Tal',
    birthDate: new Date('1990-01-01'),
    email: Email.create('user@example.com'),
    phone: '1199999999',
    cpf: '12345678909',
    address: 'Rua A, 123',
    passwordHash: 'hash'
});

describe('AddDependent use case', () => {
    it('registers a dependent for an existing user', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const owner = makeUser();
        users.seed(owner);
        const useCase = new AddDependent(users, dependents);

        const result = await useCase.exec({
            ownerUserId: owner.id,
            fullName: 'Joãozinho',
            birthDate: '2015-05-20',
            relationship: 'Filho'
        });

        expect(result.id).toBeTruthy();
        expect(result.fullName).toBe('Joãozinho');
        expect(result.birthDate?.getFullYear()).toBe(2015);
    });

    it('prevents duplicate dependents per user', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const owner = makeUser();
        users.seed(owner);
        dependents.seed(Dependent.create({ id: 'dep-1', userId: owner.id, fullName: 'Maria', birthDate: null, relationship: 'Filha', createdAt: new Date() }));
        const useCase = new AddDependent(users, dependents);

        await expect(useCase.exec({ ownerUserId: owner.id, fullName: 'Maria' })).rejects.toThrow('Dependent with this name already exists for the user');
    });

    it('validates user existence and birth date', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const useCase = new AddDependent(users, dependents);

        await expect(useCase.exec({ ownerUserId: 'missing', fullName: 'Ana' })).rejects.toThrow('User not found');

        const owner = makeUser();
        users.seed(owner);
        await expect(useCase.exec({ ownerUserId: owner.id, fullName: 'Ana', birthDate: 'invalid-date' })).rejects.toThrow('Invalid dependent birth date');
    });
});
