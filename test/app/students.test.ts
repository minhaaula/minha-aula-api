import { describe, expect, it } from 'vitest';
import { ListStudents } from '../../src/app/use-cases/list-students';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
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
        return this.items.get(id) ?? null;
    }

    async findByPersona(persona: string): Promise<User[]> {
        return Array.from(this.items.values()).filter((user) => user.persona === persona);
    }

    async save(user: User): Promise<void> {
        this.items.set(user.id, user);
    }

    seed(user: User) {
        this.items.set(user.id, user);
    }
}

class InMemoryDependentRepository implements DependentRepository {
    private readonly items = new Map<string, Dependent>();

    async findById(id: string): Promise<Dependent | null> {
        return this.items.get(id) ?? null;
    }

    async findByUserAndFullName(userId: string, fullName: string): Promise<Dependent | null> {
        return Array.from(this.items.values()).find((dep) => dep.userId === userId && dep.fullName === fullName.trim()) ?? null;
    }

    async findByUserIds(userIds: string[]): Promise<Dependent[]> {
        const allowed = new Set(userIds);
        return Array.from(this.items.values()).filter((dep) => allowed.has(dep.userId));
    }

    async save(dependent: Dependent): Promise<void> {
        this.items.set(dependent.id, dependent);
    }

    seed(dependent: Dependent) {
        this.items.set(dependent.id, dependent);
    }
}

const makeStudent = (id: string, cpf: string, createdAt: Date) => User.create({
    id,
    fullName: `Estudante ${id}`,
    birthDate: new Date('2000-01-01'),
    email: Email.create(`${id}@example.com`),
    phone: '11999990000',
    cpf,
    address: PostalAddress.create({
        street: 'Rua Teste',
        number: '100',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234000'
    }),
    persona: 'STUDENT',
    passwordHash: 'hash',
    createdAt
});

const makeDependent = (id: string, userId: string, createdAt: Date) => Dependent.create({
    id,
    userId,
    fullName: `Dependente ${id}`,
    birthDate: null,
    relationship: 'Filho',
    createdAt
});

describe('ListStudents use case', () => {
    it('returns students with their dependents ordered by creation date', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const newer = makeStudent('student-2', '12345678902', new Date('2024-01-01T10:00:00Z'));
        const older = makeStudent('student-1', '12345678901', new Date('2023-01-01T10:00:00Z'));
        users.seed(newer);
        users.seed(older);
        dependents.seed(makeDependent('dep-1', 'student-2', new Date('2024-02-01T10:00:00Z')));
        dependents.seed(makeDependent('dep-2', 'student-2', new Date('2024-03-01T10:00:00Z')));
        dependents.seed(makeDependent('dep-3', 'student-1', new Date('2023-02-01T10:00:00Z')));

        const useCase = new ListStudents(users, dependents);
        const result = await useCase.exec();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('student-2');
        expect(result[0].dependents.map((dep) => dep.id)).toEqual(['dep-2', 'dep-1']);
        expect(result[1].id).toBe('student-1');
        expect(result[1].dependents).toHaveLength(1);
        expect(result[1].dependents[0].userId).toBe('student-1');
    });

    it('returns empty list when no students are registered', async () => {
        const users = new InMemoryUserRepository();
        const dependents = new InMemoryDependentRepository();
        const useCase = new ListStudents(users, dependents);

        const result = await useCase.exec();
        expect(result).toEqual([]);
    });
});
