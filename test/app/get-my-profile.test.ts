import { describe, expect, it } from 'vitest';
import { GetMyProfile } from '../../src/app/use-cases/get-my-profile';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';
import { Dependent } from '../../src/domain/entities/dependent';

class InMemoryUserRepository implements UserRepository {
    private readonly items = new Map<string, User>();

    async findByEmail(): Promise<User | null> {
        return null;
    }

    async findByCpf(): Promise<User | null> {
        return null;
    }

    async findById(id: string): Promise<User | null> {
        return this.items.get(id) || null;
    }

    async findByPersona(): Promise<User[]> {
        return [];
    }

    async save(): Promise<void> {
        // No-op
    }

    seed(user: User) {
        this.items.set(user.id, user);
    }
}

class InMemoryDependentRepository implements DependentRepository {
    private readonly items = new Map<string, Dependent[]>();

    async findById(): Promise<Dependent | null> {
        return null;
    }

    async findByCpf(): Promise<Dependent | null> {
        return null;
    }

    async findByUserAndFullName(): Promise<Dependent | null> {
        return null;
    }

    async findByUserIds(userIds: string[]): Promise<Dependent[]> {
        const allDependents: Dependent[] = [];
        for (const userId of userIds) {
            const userDependents = this.items.get(userId) || [];
            allDependents.push(...userDependents);
        }
        return allDependents;
    }

    async save(): Promise<void> {
        // No-op
    }

    seedDependents(userId: string, dependents: Dependent[]) {
        this.items.set(userId, dependents);
    }
}

function makeUser(
    id: string = 'user-1',
    fullName: string = 'João Silva',
    email: string = 'joao@email.com',
    cpf: string = '12345678901',
    phone: string = '11999999999'
): User {
    return User.create({
        id,
        fullName,
        birthDate: new Date('1990-01-01'),
        email: Email.create(email),
        phone,
        cpf,
        address: PostalAddress.create({
            street: 'Rua Teste',
            number: '123',
            complement: null,
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234567'
        }),
        persona: UserPersonaEnum.STUDENT,
        passwordHash: 'hashed'
    });
}

function makeDependent(
    id: string,
    userId: string,
    fullName: string,
    cpf: string | null = null,
    birthDate: Date | null = null,
    relationship: string | null = null
): Dependent {
    return Dependent.create({
        id,
        userId,
        fullName,
        cpf,
        birthDate,
        relationship,
        createdAt: new Date()
    });
}

describe('GetMyProfile use case', () => {
    it('returns student profile with dependents', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const userId = 'user-1';

        const user = makeUser(userId);
        users.seed(user);

        dependents.seedDependents(userId, [
            makeDependent('dep-1', userId, 'Maria Silva', '98765432100', new Date('2015-05-20'), 'Filha'),
            makeDependent('dep-2', userId, 'Pedro Silva', null, null, null)
        ]);

        const useCase = new GetMyProfile(users, dependents);
        const profile = await useCase.exec({ userId });

        expect(profile).not.toBeNull();
        expect(profile!.id).toBe(userId);
        expect(profile!.fullName).toBe('João Silva');
        expect(profile!.email).toBe('joao@email.com');
        expect(profile!.cpf).toBe('12345678901');
        expect(profile!.phone).toBe('11999999999');
        expect(profile!.address).toBeDefined();
        expect(profile!.address.street).toBe('Rua Teste');
        expect(profile!.address.number).toBe('123');
        expect(profile!.address.complement).toBeNull();
        expect(profile!.address.district).toBe('Centro');
        expect(profile!.address.city).toBe('São Paulo');
        expect(profile!.address.state).toBe('SP');
        expect(profile!.address.zipCode).toBe('01234567');
        expect(profile!.dependents).toHaveLength(2);
        expect(profile!.dependents[0].fullName).toBe('Maria Silva');
        expect(profile!.dependents[1].fullName).toBe('Pedro Silva');
    });

    it('returns student profile without dependents', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const userId = 'user-1';

        const user = makeUser(userId);
        users.seed(user);

        const useCase = new GetMyProfile(users, dependents);
        const profile = await useCase.exec({ userId });

        expect(profile).not.toBeNull();
        expect(profile!.id).toBe(userId);
        expect(profile!.address).toBeDefined();
        expect(profile!.dependents).toHaveLength(0);
    });

    it('returns null when user not found', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();

        const useCase = new GetMyProfile(users, dependents);
        const profile = await useCase.exec({ userId: 'non-existent' });

        expect(profile).toBeNull();
    });

    it('returns null when userId is empty', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();

        const useCase = new GetMyProfile(users, dependents);
        const profile = await useCase.exec({ userId: '' });

        expect(profile).toBeNull();
    });

    it('handles dependents with null optional fields', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const userId = 'user-1';

        const user = makeUser(userId);
        users.seed(user);

        dependents.seedDependents(userId, [
            makeDependent('dep-1', userId, 'Maria Silva', null, null, null)
        ]);

        const useCase = new GetMyProfile(users, dependents);
        const profile = await useCase.exec({ userId });

        expect(profile).not.toBeNull();
        expect(profile!.dependents).toHaveLength(1);
        expect(profile!.dependents[0].cpf).toBeNull();
        expect(profile!.dependents[0].birthDate).toBeNull();
        expect(profile!.dependents[0].relationship).toBeNull();
    });
});

