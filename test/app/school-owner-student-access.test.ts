import { describe, expect, it, vi } from 'vitest';
import { LoginUser } from '../../src/app/use-cases/auth/login-user';
import { RefreshToken } from '../../src/app/use-cases/auth/refresh-token';
import { UpdateSchool } from '../../src/app/use-cases/schools/update-school';
import { GetStudentDirectoryEntry } from '../../src/app/use-cases/students/get-student-directory-entry';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { School } from '../../src/domain/entities/school';
import { AppError, ErrorCode } from '../../src/shared/errors';
import { DependentRepository } from '../../src/ports/repositories/dependent.repo';

class InMemoryUserRepository implements UserRepository {
    private readonly users = new Map<string, User>();

    async findByEmail(email: string): Promise<User | null> {
        return Array.from(this.users.values()).find((u) => u.email.value === email.toLowerCase()) ?? null;
    }

    async findByCpf(cpf: string): Promise<User | null> {
        const digits = cpf.replace(/\D/g, '');
        return Array.from(this.users.values()).find((u) => u.cpf === digits) ?? null;
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

class InMemorySchoolRepository implements Partial<SchoolRepository> {
    private readonly schools = new Map<string, School>();

    async findById(id: string): Promise<School | null> {
        return this.schools.get(id) ?? null;
    }

    async findByOwnerUserId(userId: string): Promise<School | null> {
        return Array.from(this.schools.values()).find((s) => s.ownerUserId === userId) ?? null;
    }

    async save(school: School): Promise<void> {
        this.schools.set(school.id, school);
    }

    seed(school: School) {
        this.schools.set(school.id, school);
    }
}

class InMemoryDependentRepository implements DependentRepository {
    async findById(): Promise<null> {
        return null;
    }

    async findByCpf(): Promise<null> {
        return null;
    }

    async findByUserAndFullName(): Promise<null> {
        return null;
    }

    async findByUserIds(): Promise<[]> {
        return [];
    }

    async save(): Promise<void> {}
}

const makeAddress = () =>
    PostalAddress.create({
        street: 'Rua A',
        number: '1',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234000'
    });

const makeSchoolOwner = (overrides?: { studentAccessEnabled?: boolean }) =>
    User.create({
        id: 'owner-user-1',
        fullName: 'Dono Escola',
        birthDate: new Date('1985-05-10'),
        email: Email.create('dono@escola.com'),
        phone: '11988887777',
        cpf: '52998224725',
        address: makeAddress(),
        persona: UserPersonaEnum.SCHOOL,
        passwordHash: 'hashed-password',
        studentAccessEnabled: overrides?.studentAccessEnabled ?? true
    });

const makeSchool = (ownerUserId: string) =>
    School.create({
        id: 'school-1',
        name: 'Escola Teste',
        email: 'escola@teste.com',
        phone: '1133334444',
        ownerUserId,
        ownerName: 'Dono Escola',
        ownerCpf: '52998224725',
        ownerEmail: 'dono@escola.com',
        ownerPasswordHash: 'hashed-password'
    });

describe('School owner student access', () => {
    it('login as student issues STUDENT token when flag is enabled', async () => {
        const users = new InMemoryUserRepository();
        const schools = new InMemorySchoolRepository() as SchoolRepository;
        const owner = makeSchoolOwner({ studentAccessEnabled: true });
        users.seed(owner);
        schools.seed(makeSchool(owner.id));

        const hasher = { compare: vi.fn().mockResolvedValue(true) };
        const tokens = {
            sign: vi.fn().mockImplementation(async (payload: { persona: string }) => {
                return `token-${payload.persona}`;
            })
        };

        const login = new LoginUser(users, hasher, tokens, 3600, ['students'], schools);
        const result = await login.exec({ cpf: owner.cpf, password: 'secret' });

        expect(result.persona).toBe(UserPersonaEnum.STUDENT);
        expect(result.studentAccessEnabled).toBe(true);
        expect(tokens.sign).toHaveBeenCalledWith(
            expect.objectContaining({ persona: UserPersonaEnum.STUDENT, sub: owner.id }),
            expect.any(Object)
        );
    });

    it('login as student fails when flag is disabled', async () => {
        const users = new InMemoryUserRepository();
        const owner = makeSchoolOwner({ studentAccessEnabled: false });
        users.seed(owner);

        const hasher = { compare: vi.fn().mockResolvedValue(true) };
        const tokens = { sign: vi.fn() };

        const login = new LoginUser(users, hasher, tokens, 3600, ['students']);

        await expect(login.exec({ cpf: owner.cpf, password: 'secret' })).rejects.toMatchObject({
            code: ErrorCode.STUDENT_ACCESS_NOT_ENABLED
        });
    });

    it('refresh token preserves STUDENT session persona', async () => {
        const users = new InMemoryUserRepository();
        const owner = makeSchoolOwner({ studentAccessEnabled: true });
        users.seed(owner);

        const tokens = {
            verify: vi.fn().mockResolvedValue({
                sub: owner.id,
                type: 'refresh',
                persona: UserPersonaEnum.STUDENT,
                cpf: owner.cpf,
                fullName: owner.fullName,
                email: owner.email.value
            }),
            sign: vi.fn().mockImplementation(async (payload: { persona: string }) => `access-${payload.persona}`)
        };

        const refresh = new RefreshToken(tokens, users, undefined, 3600);
        const result = await refresh.exec({ refreshToken: 'refresh-token' });

        expect(result.accessToken).toBe(`access-${UserPersonaEnum.STUDENT}`);
        expect(tokens.sign).toHaveBeenCalledWith(
            expect.objectContaining({ persona: UserPersonaEnum.STUDENT }),
            expect.any(Object)
        );
    });

    it('refresh fails when student access was revoked', async () => {
        const users = new InMemoryUserRepository();
        const owner = makeSchoolOwner({ studentAccessEnabled: false });
        users.seed(owner);

        const tokens = {
            verify: vi.fn().mockResolvedValue({
                sub: owner.id,
                type: 'refresh',
                persona: UserPersonaEnum.STUDENT,
                cpf: owner.cpf,
                fullName: owner.fullName,
                email: owner.email.value
            }),
            sign: vi.fn()
        };

        const refresh = new RefreshToken(tokens, users, undefined, 3600);

        await expect(refresh.exec({ refreshToken: 'refresh-token' })).rejects.toMatchObject({
            code: ErrorCode.STUDENT_ACCESS_NOT_ENABLED
        });
    });

    it('update school can disable owner student access', async () => {
        const users = new InMemoryUserRepository();
        const schools = new InMemorySchoolRepository() as SchoolRepository;
        const owner = makeSchoolOwner({ studentAccessEnabled: true });
        users.seed(owner);
        schools.seed(makeSchool(owner.id));

        const hasher = { hash: vi.fn().mockResolvedValue('new-hash') };
        const update = new UpdateSchool(schools, hasher, users);

        const result = await update.exec({
            schoolId: 'school-1',
            ownerStudentAccessEnabled: false
        });

        expect(result.ownerStudentAccessEnabled).toBe(false);

        const saved = await users.findById(owner.id);
        expect(saved?.studentAccessEnabled).toBe(false);
    });

    it('directory finds school owner by CPF when student access enabled', async () => {
        const users = new InMemoryUserRepository();
        const owner = makeSchoolOwner({ studentAccessEnabled: true });
        users.seed(owner);

        const directory = new GetStudentDirectoryEntry(users, new InMemoryDependentRepository());
        const entry = await directory.exec({ cpf: owner.cpf });

        expect(entry).not.toBeNull();
        expect(entry?.student.id).toBe(owner.id);
        expect(entry?.isDependent).toBe(false);
    });

    it('directory ignores school owner when student access disabled', async () => {
        const users = new InMemoryUserRepository();
        const owner = makeSchoolOwner({ studentAccessEnabled: false });
        users.seed(owner);

        const directory = new GetStudentDirectoryEntry(users, new InMemoryDependentRepository());
        const entry = await directory.exec({ cpf: owner.cpf });

        expect(entry).toBeNull();
    });

    it('native STUDENT login unchanged', async () => {
        const users = new InMemoryUserRepository();
        const student = User.create({
            id: 'student-1',
            fullName: 'Aluno Puro',
            birthDate: new Date('2000-01-01'),
            email: Email.create('aluno@example.com'),
            phone: '11999998888',
            cpf: '39053344705',
            address: makeAddress(),
            persona: UserPersonaEnum.STUDENT,
            passwordHash: 'hash'
        });
        users.seed(student);

        const hasher = { compare: vi.fn().mockResolvedValue(true) };
        const tokens = {
            sign: vi.fn().mockImplementation(async (payload: { persona: string }) => `token-${payload.persona}`)
        };

        const login = new LoginUser(users, hasher, tokens, 3600, ['students']);
        const result = await login.exec({ cpf: student.cpf, password: 'x' });

        expect(result.persona).toBe(UserPersonaEnum.STUDENT);
    });
});

describe('canActAsStudent helper', () => {
    it('throws AppError with expected code for disabled school owner login', async () => {
        const users = new InMemoryUserRepository();
        users.seed(makeSchoolOwner({ studentAccessEnabled: false }));

        const login = new LoginUser(
            users,
            { compare: vi.fn().mockResolvedValue(true) },
            { sign: vi.fn() },
            3600,
            ['students']
        );

        try {
            await login.exec({ cpf: '52998224725', password: 'x' });
            expect.fail('should throw');
        } catch (e) {
            expect(e).toBeInstanceOf(AppError);
            expect((e as AppError).code).toBe(ErrorCode.STUDENT_ACCESS_NOT_ENABLED);
        }
    });
});
