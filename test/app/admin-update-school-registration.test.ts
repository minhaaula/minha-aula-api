import { describe, expect, it } from 'vitest';
import { AdminUpdateSchoolRegistration } from '../../src/app/use-cases/admin/admin-update-school-registration';
import { UpdateSchool } from '../../src/app/use-cases/schools/update-school';
import { School } from '../../src/domain/entities/school';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { PasswordHasherPort } from '../../src/ports/providers/password-hasher.port';
import { AppError, ErrorCode } from '../../src/shared/errors';

class InMemorySchoolRepo implements SchoolRepository {
    constructor(private readonly schools: Map<string, School>) {}

    async findById(id: string) {
        return this.schools.get(id) ?? null;
    }
    async findByEmail() {
        return null;
    }
    async findByCnpj() {
        return null;
    }
    async findByOwnerUserId() {
        return null;
    }
    async findByOwnerEmail() {
        return null;
    }
    async findByAccountId() {
        return null;
    }
    async findAll() {
        return [...this.schools.values()];
    }
    async save(school: School) {
        this.schools.set(school.id, school);
    }
}

class TestHasher implements PasswordHasherPort {
    async hash(value: string) {
        return `hashed:${value}`;
    }
    async compare(value: string, hash: string) {
        return hash === `hashed:${value}`;
    }
}

function makeSchool(id: string, onboardingCompletedAt: Date | null = null) {
    return School.create({
        id,
        name: 'Escola Teste',
        email: 'escola@teste.com',
        phone: '11999999999',
        cnpj: '12345678000199',
        addresses: [
            PostalAddress.create({
                street: 'Rua A',
                number: '1',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01000000'
            })
        ],
        ownerName: 'Titular',
        ownerCpf: '12345678909',
        ownerEmail: 'titular@teste.com',
        ownerPasswordHash: 'hash',
        onboardingCompletedAt
    });
}

describe('AdminUpdateSchoolRegistration', () => {
    it('updates school when onboarding is not complete', async () => {
        const school = makeSchool('school-1', null);
        const repo = new InMemorySchoolRepo(new Map([['school-1', school]]));
        const updateSchool = new UpdateSchool(repo, new TestHasher());
        const useCase = new AdminUpdateSchoolRegistration(repo, updateSchool);

        const result = await useCase.exec({
            schoolId: 'school-1',
            name: 'Escola Atualizada'
        });

        expect(result.name).toBe('Escola Atualizada');
        const stored = await repo.findById('school-1');
        expect(stored?.name).toBe('Escola Atualizada');
        expect(stored?.onboardingCompletedAt).toBeNull();
    });

    it('rejects update when onboarding is already complete', async () => {
        const school = makeSchool('school-1', new Date('2025-01-01'));
        const repo = new InMemorySchoolRepo(new Map([['school-1', school]]));
        const updateSchool = new UpdateSchool(repo, new TestHasher());
        const useCase = new AdminUpdateSchoolRegistration(repo, updateSchool);

        await expect(
            useCase.exec({ schoolId: 'school-1', name: 'Nova' })
        ).rejects.toMatchObject({
            code: ErrorCode.SCHOOL_ONBOARDING_ALREADY_COMPLETED
        });
    });

    it('returns school not found', async () => {
        const repo = new InMemorySchoolRepo(new Map());
        const useCase = new AdminUpdateSchoolRegistration(
            repo,
            new UpdateSchool(repo, new TestHasher())
        );

        await expect(useCase.exec({ schoolId: 'missing', name: 'X' })).rejects.toBeInstanceOf(AppError);
    });
});
