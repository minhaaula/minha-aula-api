import { describe, expect, it } from 'vitest';
import { ListAllStudents } from '../../src/app/use-cases/admin/list-all-students';
import type {
    AdminStudentListFilters,
    AdminStudentListItem,
    AdminStudentListResult
} from '../../src/ports/repositories/enrollment.repo';
import type { EnrollmentRepository } from '../../src/ports/repositories/enrollment.repo';
import type { UserRepository } from '../../src/ports/repositories/user.repo';
import type { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import { Dependent } from '../../src/domain/entities/dependent';

const titularItem: AdminStudentListItem = {
    cpf: '12345678909',
    studentId: 'user-1',
    studentName: 'Titular',
    status: 'ACTIVE',
    studentType: 'USER',
    birthDate: '1990-01-01',
    endereco: {
        street: 'Rua A',
        number: '1',
        complement: null,
        district: null,
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310100'
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    countCursos: 2,
    dependentes: []
};

class InMemoryUsers implements Pick<UserRepository, 'findStudentsPaginatedForAdmin'> {
    async findStudentsPaginatedForAdmin(
        _filters: AdminStudentListFilters,
        limit: number,
        offset: number
    ): Promise<AdminStudentListResult> {
        return { items: [{ ...titularItem }], total: 1, limit, offset };
    }
}

class InMemoryDependents implements Pick<DependentRepository, 'findByUserIds'> {
    async findByUserIds(userIds: string[]) {
        if (!userIds.includes('user-1')) return [];
        return [
            Dependent.create({
                id: 'dep-1',
                userId: 'user-1',
                fullName: 'Filho Menor',
                cpf: null,
                birthDate: new Date('2015-06-01'),
                relationship: 'Filho(a)'
            })
        ];
    }
}

class InMemoryEnrollments implements Pick<EnrollmentRepository, 'countActiveEnrollmentsByDependentIds'> {
    async countActiveEnrollmentsByDependentIds(dependentIds: string[]) {
        const map = new Map<string, number>();
        for (const id of dependentIds) {
            map.set(id, id === 'dep-1' ? 3 : 0);
        }
        return map;
    }
}

describe('ListAllStudents', () => {
    it('inclui countCursos em cada dependente', async () => {
        const useCase = new ListAllStudents(
            new InMemoryEnrollments() as EnrollmentRepository,
            new InMemoryUsers() as UserRepository,
            new InMemoryDependents() as DependentRepository
        );

        const result = await useCase.exec({ limit: 50, offset: 0 });

        expect(result.items[0].countCursos).toBe(2);
        expect(result.items[0].dependentes).toHaveLength(1);
        expect(result.items[0].dependentes[0]).toMatchObject({
            id: 'dep-1',
            nome: 'Filho Menor',
            countCursos: 3
        });
    });
});
