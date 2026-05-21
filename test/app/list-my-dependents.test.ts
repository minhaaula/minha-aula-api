import { describe, expect, it } from 'vitest';
import { ListMyDependents } from '../../src/app/use-cases/students/list-my-dependents';
import { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import { Dependent } from '../../src/domain/entities/dependent';

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

describe('ListMyDependents use case', () => {
    it('returns all dependents for a user', async () => {
        const repo = new InMemoryDependentRepository();
        const userId = 'user-1';

        repo.seedDependents(userId, [
            makeDependent('dep-1', userId, 'João Silva', '12345678901', new Date('2015-05-20'), 'Filho'),
            makeDependent('dep-2', userId, 'Maria Silva', '98765432100', new Date('2018-03-15'), 'Filha')
        ]);

        const useCase = new ListMyDependents(repo);
        const result = await useCase.exec({ userId });

        expect(result.dependents).toHaveLength(2);
        expect(result.dependents[0].id).toBe('dep-1');
        expect(result.dependents[0].fullName).toBe('João Silva');
        expect(result.dependents[0].cpf).toBe('12345678901');
        expect(result.dependents[0].relationship).toBe('Filho');
        expect(result.dependents[1].fullName).toBe('Maria Silva');
    });

    it('returns empty list when user has no dependents', async () => {
        const repo = new InMemoryDependentRepository();
        const userId = 'user-1';

        const useCase = new ListMyDependents(repo);
        const result = await useCase.exec({ userId });

        expect(result.dependents).toHaveLength(0);
    });

    it('returns empty list when userId is empty', async () => {
        const repo = new InMemoryDependentRepository();
        const useCase = new ListMyDependents(repo);
        const result = await useCase.exec({ userId: '' });

        expect(result.dependents).toHaveLength(0);
    });

    it('handles dependents without optional fields', async () => {
        const repo = new InMemoryDependentRepository();
        const userId = 'user-1';

        repo.seedDependents(userId, [
            makeDependent('dep-1', userId, 'João Silva', null, null, null)
        ]);

        const useCase = new ListMyDependents(repo);
        const result = await useCase.exec({ userId });

        expect(result.dependents).toHaveLength(1);
        expect(result.dependents[0].cpf).toBeNull();
        expect(result.dependents[0].birthDate).toBeNull();
        expect(result.dependents[0].relationship).toBeNull();
    });

    it('only returns dependents for the specified user', async () => {
        const repo = new InMemoryDependentRepository();

        repo.seedDependents('user-1', [
            makeDependent('dep-1', 'user-1', 'João Silva')
        ]);

        repo.seedDependents('user-2', [
            makeDependent('dep-2', 'user-2', 'Maria Silva')
        ]);

        const useCase = new ListMyDependents(repo);
        const result = await useCase.exec({ userId: 'user-1' });

        expect(result.dependents).toHaveLength(1);
        expect(result.dependents[0].id).toBe('dep-1');
        expect(result.dependents[0].fullName).toBe('João Silva');
    });
});

