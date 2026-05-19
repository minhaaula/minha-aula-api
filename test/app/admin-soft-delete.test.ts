import { describe, expect, it } from 'vitest';
import { AdminSoftDeleteSchool } from '../../src/app/use-cases/admin-soft-delete-school';
import { AdminSoftDeleteUser } from '../../src/app/use-cases/admin-soft-delete-user';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { School } from '../../src/domain/entities/school';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';
import { AppError, ErrorCode } from '../../src/shared/errors';

class InMemorySchoolRepo implements SchoolRepository {
    private readonly schools = new Map<string, School>();
    private readonly deleted = new Set<string>();

    async findById(id: string): Promise<School | null> {
        return this.schools.get(id) ?? null;
    }

    async findByEmail(): Promise<School | null> {
        return null;
    }

    async findByCnpj(): Promise<School | null> {
        return null;
    }

    async findByOwnerUserId(userId: string): Promise<School | null> {
        for (const school of this.schools.values()) {
            if (school.ownerUserId === userId && !this.deleted.has(school.id)) {
                return school;
            }
        }
        return null;
    }

    async findByOwnerEmail(): Promise<School | null> {
        return null;
    }

    async findByAccountId(): Promise<School | null> {
        return null;
    }

    async findAll(): Promise<School[]> {
        return Array.from(this.schools.values()).filter((s) => !this.deleted.has(s.id));
    }

    async save(school: School): Promise<void> {
        this.schools.set(school.id, school);
    }

    async softDeleteByAdmin(schoolId: string): Promise<void> {
        this.deleted.add(schoolId);
    }

    async isDeleted(schoolId: string): Promise<boolean> {
        return this.deleted.has(schoolId);
    }

    seed(school: School) {
        this.schools.set(school.id, school);
    }
}

class InMemoryUserRepo implements UserRepository {
    private readonly users = new Map<string, User>();
    private readonly deleted = new Set<string>();

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
        return [];
    }

    async save(user: User): Promise<void> {
        this.users.set(user.id, user);
    }

    async softDeleteByAdmin(userId: string): Promise<void> {
        this.deleted.add(userId);
    }

    async isDeletedByAdmin(userId: string): Promise<boolean> {
        return this.deleted.has(userId);
    }

    seed(user: User) {
        this.users.set(user.id, user);
    }
}

const makeSchool = (id: string, ownerUserId: string | null = null) =>
    School.create({
        id,
        name: 'Escola Teste',
        email: 'escola@example.com',
        phone: '11999999999',
        cnpj: '12345678000199',
        addresses: [
            PostalAddress.create({
                street: 'Rua A',
                number: '1',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234000'
            })
        ],
        ownerUserId,
        ownerName: 'Dono',
        ownerCpf: '12345678909',
        ownerEmail: 'dono@example.com'
    });

const makeUser = (id: string, persona: string = UserPersonaEnum.STUDENT) =>
    User.create({
        id,
        fullName: 'Usuário',
        birthDate: new Date('1990-01-01'),
        email: Email.create('user@example.com'),
        phone: '11999999999',
        cpf: '12345678909',
        address: PostalAddress.create({
            street: 'Rua A',
            number: '1',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234000'
        }),
        persona,
        passwordHash: 'hash'
    });

describe('Admin soft delete use cases', () => {
    it('soft deletes user when no active school is linked', async () => {
        const users = new InMemoryUserRepo();
        const schools = new InMemorySchoolRepo();
        users.seed(makeUser('user-1'));

        const useCase = new AdminSoftDeleteUser(users, schools);
        const result = await useCase.exec({ userId: 'user-1' });

        expect(result.alreadyDeleted).toBe(false);
        expect(await users.isDeletedByAdmin!('user-1')).toBe(true);
    });

    it('blocks user delete when active school exists', async () => {
        const users = new InMemoryUserRepo();
        const schools = new InMemorySchoolRepo();
        users.seed(makeUser('owner-1', UserPersonaEnum.SCHOOL));
        schools.seed(makeSchool('school-1', 'owner-1'));

        const useCase = new AdminSoftDeleteUser(users, schools);
        await expect(useCase.exec({ userId: 'owner-1' })).rejects.toMatchObject({
            code: ErrorCode.CANNOT_DELETE_USER_WITH_ACTIVE_SCHOOL
        });
    });

    it('soft deletes school and optionally owner', async () => {
        const users = new InMemoryUserRepo();
        const schools = new InMemorySchoolRepo();
        users.seed(makeUser('owner-1', UserPersonaEnum.SCHOOL));
        schools.seed(makeSchool('school-1', 'owner-1'));

        const deleteUser = new AdminSoftDeleteUser(users, schools);
        const deleteSchool = new AdminSoftDeleteSchool(schools, deleteUser);

        const result = await deleteSchool.exec({ schoolId: 'school-1', deleteOwnerUser: true });

        expect(result.alreadyDeleted).toBe(false);
        expect(result.ownerUserDeleted).toBe(true);
        expect(await schools.isDeleted!('school-1')).toBe(true);
        expect(await users.isDeletedByAdmin!('owner-1')).toBe(true);
    });

    it('blocks deleting admin user', async () => {
        const users = new InMemoryUserRepo();
        const schools = new InMemorySchoolRepo();
        users.seed(makeUser('admin-1', UserPersonaEnum.ADMIN));

        const useCase = new AdminSoftDeleteUser(users, schools);
        await expect(useCase.exec({ userId: 'admin-1' })).rejects.toBeInstanceOf(AppError);
        await expect(useCase.exec({ userId: 'admin-1' })).rejects.toMatchObject({
            code: ErrorCode.CANNOT_DELETE_ADMIN_USER
        });
    });
});
