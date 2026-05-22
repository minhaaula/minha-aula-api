import { describe, expect, it } from 'vitest';
import { AddDependent } from '../../src/app/use-cases/students/add-dependent';
import { UpdateDependent } from '../../src/app/use-cases/students/update-dependent';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { Dependent } from '../../src/domain/entities/dependent';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';

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

    async findByPersona(): Promise<User[]> {
        return Array.from(this.users.values());
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

    async findByCpf(cpf: string): Promise<Dependent | null> {
        const normalized = cpf.replace(/\D/g, '');
        return Array.from(this.dependents.values()).find((dep) => dep.cpf === normalized) ?? null;
    }

    async findByUserAndFullName(userId: string, fullName: string): Promise<Dependent | null> {
        return Array.from(this.dependents.values()).find((dep) => dep.userId === userId && dep.fullName === fullName.trim()) ?? null;
    }

    async findByUserIds(userIds: string[]): Promise<Dependent[]> {
        const set = new Set(userIds);
        return Array.from(this.dependents.values()).filter((dep) => set.has(dep.userId));
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
    address: PostalAddress.create({
        street: 'Rua A',
        number: '123',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234000'
    }),
    persona: 'STUDENT',
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
            cpf: '123.456.789-01',
            birthDate: '2015-05-20',
            relationship: 'Filho'
        });

        expect(result.id).toBeTruthy();
        expect(result.fullName).toBe('Joãozinho');
        expect(result.birthDate?.getFullYear()).toBe(2015);
        expect(result.cpf).toBe('12345678901');
    });

    it('prevents duplicate dependents per user', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const owner = makeUser();
        users.seed(owner);
        dependents.seed(Dependent.create({ id: 'dep-1', userId: owner.id, fullName: 'Maria', cpf: '11122233344', birthDate: null, relationship: 'Filha', createdAt: new Date() }));
        const useCase = new AddDependent(users, dependents);

        await expect(useCase.exec({ ownerUserId: owner.id, fullName: 'Maria' })).rejects.toThrow('Dependente com este nome já existe para o usuário');
    });

    it('validates user existence and birth date', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const useCase = new AddDependent(users, dependents);

        await expect(useCase.exec({ ownerUserId: 'missing', fullName: 'Ana' })).rejects.toThrow('Usuário não encontrado');

        const owner = makeUser();
        users.seed(owner);
        await expect(useCase.exec({ ownerUserId: owner.id, fullName: 'Ana', birthDate: 'invalid-date' })).rejects.toThrow('Data de nascimento inválida');
    });

    it('prevents duplicate dependent CPF', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const owner = makeUser();
        users.seed(owner);
        dependents.seed(Dependent.create({
            id: 'dep-1',
            userId: owner.id,
            fullName: 'Maria',
            cpf: '22233344455',
            birthDate: null,
            relationship: 'Filha',
            createdAt: new Date()
        }));
        const useCase = new AddDependent(users, dependents);

        await expect(useCase.exec({ ownerUserId: owner.id, fullName: 'Carla', cpf: '22233344455' }))
            .rejects.toThrow('CPF já cadastrado');
    });

    it('allows setting gender on existing dependent via update', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const owner = makeUser();
        users.seed(owner);
        dependents.seed(
            Dependent.create({
                id: 'dep-legacy',
                userId: owner.id,
                fullName: 'Maria',
                cpf: null,
                birthDate: null,
                relationship: 'Filha',
                createdAt: new Date()
            })
        );

        const update = new UpdateDependent(dependents);
        const result = await update.exec({
            ownerUserId: owner.id,
            dependentId: 'dep-legacy',
            gender: 'FEMALE'
        });

        expect(result.gender).toBe('FEMALE');
    });
});
