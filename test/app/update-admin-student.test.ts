import { describe, expect, it } from 'vitest';
import { UpdateAdminStudent } from '../../src/app/use-cases/admin/update-admin-student';
import { User } from '../../src/domain/entities/user';
import { Dependent } from '../../src/domain/entities/dependent';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import { AppError } from '../../src/shared/errors';

class InMemoryUsers implements UserRepository {
    constructor(private readonly map: Map<string, User>) {}
    async findByEmail(email: string) {
        for (const u of this.map.values()) {
            if (u.email.value === email.toLowerCase()) return u;
        }
        return null;
    }
    async findByCpf(cpf: string) {
        const digits = cpf.replace(/\D/g, '');
        for (const u of this.map.values()) {
            if (u.cpf === digits) return u;
        }
        return null;
    }
    async findById(id: string) {
        return this.map.get(id) ?? null;
    }
    async findByPersona() {
        return [];
    }
    async save(user: User) {
        this.map.set(user.id, user);
    }
    async isDeletedByAdmin() {
        return false;
    }
}

class InMemoryDependents implements DependentRepository {
    constructor(private readonly map: Map<string, Dependent>) {}
    async findById(id: string) {
        return this.map.get(id) ?? null;
    }
    async findByCpf(cpf: string) {
        const digits = cpf.replace(/\D/g, '');
        for (const d of this.map.values()) {
            if (d.cpf === digits) return d;
        }
        return null;
    }
    async findByUserAndFullName() {
        return null;
    }
    async findByUserIds() {
        return [];
    }
    async save(dep: Dependent) {
        this.map.set(dep.id, dep);
    }
}

function makeUser(id = 'user-1') {
    return User.create({
        id,
        fullName: 'Maria Silva',
        birthDate: new Date('1990-03-15'),
        email: Email.create('maria@email.com'),
        phone: '11999999999',
        cpf: '12345678909',
        address: PostalAddress.create({
            street: 'Rua A',
            number: '10',
            city: 'SP',
            state: 'SP',
            zipCode: '01000000'
        }),
        persona: UserPersonaEnum.STUDENT,
        passwordHash: 'hash'
    });
}

describe('UpdateAdminStudent', () => {
    it('updates titular including phone and cpf', async () => {
        const users = new InMemoryUsers(new Map([['user-1', makeUser()]]));
        const useCase = new UpdateAdminStudent(users, new InMemoryDependents(new Map()));

        const result = await useCase.exec({
            studentId: 'user-1',
            phone: '11988887777',
            cpf: '98765432100',
            gender: 'FEMALE'
        });

        expect(result.studentType).toBe('USER');
        if (result.studentType === 'USER') {
            expect(result.phone).toBe('11988887777');
            expect(result.cpf).toBe('98765432100');
            expect(result.gender).toBe('FEMALE');
        }
    });

    it('updates dependent cpf and relationship', async () => {
        const owner = makeUser('owner-1');
        const dep = Dependent.create({
            id: 'dep-1',
            userId: 'owner-1',
            fullName: 'João',
            cpf: null,
            birthDate: new Date('2015-01-01'),
            relationship: 'Filho'
        });
        const users = new InMemoryUsers(new Map([['owner-1', owner]]));
        const dependents = new InMemoryDependents(new Map([['dep-1', dep]]));
        const useCase = new UpdateAdminStudent(users, dependents);

        const result = await useCase.exec({
            studentId: 'dep-1',
            cpf: '11144477735',
            relationship: 'Filho(a)'
        });

        expect(result.studentType).toBe('DEPENDENT');
        if (result.studentType === 'DEPENDENT') {
            expect(result.cpf).toBe('11144477735');
            expect(result.relationship).toBe('Filho(a)');
        }
    });

    it('deactivates titular when status is INACTIVE', async () => {
        const users = new InMemoryUsers(new Map([['user-1', makeUser()]]));
        const useCase = new UpdateAdminStudent(users, new InMemoryDependents(new Map()));

        const result = await useCase.exec({
            studentId: 'user-1',
            status: 'INACTIVE',
            deactivationDescription: 'Solicitação do suporte'
        });

        expect(result.studentType).toBe('USER');
        if (result.studentType === 'USER') {
            expect(result.status).toBe('INACTIVE');
        }
        const saved = await users.findById('user-1');
        expect(saved?.active).toBe(false);
        expect(saved?.deactivationReason).toBe('ADMIN');
        expect(saved?.deactivationDescription).toBe('Solicitação do suporte');
    });

    it('reactivates titular when status is ACTIVE', async () => {
        const inactive = User.create({
            id: 'user-1',
            fullName: 'Maria Silva',
            birthDate: new Date('1990-03-15'),
            email: Email.create('maria@email.com'),
            phone: '11999999999',
            cpf: '12345678909',
            address: PostalAddress.create({
                street: 'Rua A',
                number: '10',
                city: 'SP',
                state: 'SP',
                zipCode: '01000000'
            }),
            persona: UserPersonaEnum.STUDENT,
            passwordHash: 'hash',
            active: false,
            deactivationReason: 'ADMIN',
            deactivationDescription: 'Teste'
        });
        const users = new InMemoryUsers(new Map([['user-1', inactive]]));
        const useCase = new UpdateAdminStudent(users, new InMemoryDependents(new Map()));

        const result = await useCase.exec({ studentId: 'user-1', status: 'ACTIVE' });

        expect(result.studentType).toBe('USER');
        if (result.studentType === 'USER') {
            expect(result.status).toBe('ACTIVE');
        }
        const saved = await users.findById('user-1');
        expect(saved?.active).toBe(true);
        expect(saved?.deactivationReason).toBeNull();
        expect(saved?.deactivationDescription).toBeNull();
    });

    it('rejects status change for dependent', async () => {
        const owner = makeUser('owner-1');
        const dep = Dependent.create({
            id: 'dep-1',
            userId: 'owner-1',
            fullName: 'João',
            cpf: null,
            birthDate: new Date('2015-01-01'),
            relationship: 'Filho'
        });
        const users = new InMemoryUsers(new Map([['owner-1', owner]]));
        const dependents = new InMemoryDependents(new Map([['dep-1', dep]]));
        const useCase = new UpdateAdminStudent(users, dependents);

        await expect(useCase.exec({ studentId: 'dep-1', status: 'INACTIVE' })).rejects.toBeInstanceOf(AppError);
    });

    it('rejects duplicate cpf', async () => {
        const users = new InMemoryUsers(
            new Map([
                ['user-1', makeUser('user-1')],
                [
                    'user-2',
                    User.create({
                        id: 'user-2',
                        fullName: 'Outro',
                        birthDate: new Date('1991-01-01'),
                        email: Email.create('outro@email.com'),
                        phone: '11911111111',
                        cpf: '98765432100',
                        address: PostalAddress.create({
                            street: 'Rua B',
                            number: '2',
                            city: 'SP',
                            state: 'SP',
                            zipCode: '01000000'
                        }),
                        persona: UserPersonaEnum.STUDENT,
                        passwordHash: 'hash'
                    })
                ]
            ])
        );
        const useCase = new UpdateAdminStudent(users, new InMemoryDependents(new Map()));

        await expect(
            useCase.exec({ studentId: 'user-1', cpf: '98765432100' })
        ).rejects.toBeInstanceOf(AppError);
    });
});
