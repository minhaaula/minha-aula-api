import { describe, expect, it, vi } from 'vitest';
import { UpdateStudentProfile } from '../../src/app/use-cases/students/update-student-profile';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';
import type { UserRepository } from '../../src/ports/repositories/user.repo';
import type { TokenProviderPort } from '../../src/ports/providers/token-provider.port';
import { AppError, ErrorCode } from '../../src/shared/errors';
import { Uuid } from '../../src/shared/uuid';

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

    async findByPersona(): Promise<User[]> {
        return [];
    }

    async save(user: User): Promise<void> {
        this.items.set(user.id, user);
    }

    seed(user: User) {
        this.items.set(user.id, user);
    }
}

function makeUser(persona: typeof UserPersonaEnum.STUDENT | typeof UserPersonaEnum.SCHOOL = UserPersonaEnum.STUDENT): User {
    return User.create({
        id: Uuid(),
        fullName: 'João Escola',
        birthDate: new Date('1985-03-10'),
        email: Email.create('joao@escola.com'),
        phone: '11988887777',
        cpf: '12345678909',
        address: PostalAddress.create({
            street: 'Rua A',
            number: '1',
            complement: null,
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01000000'
        }),
        persona,
        passwordHash: 'hash',
        createdAt: new Date(),
        active: true,
        deactivationReason: null,
        deactivationDescription: null,
        photoStorageKey: null,
        studentAccessEnabled: true,
        gender: 'MALE'
    });
}

const tokenProvider: TokenProviderPort = {
    sign: vi.fn(async () => 'token'),
    verify: vi.fn(async (token: string) => JSON.parse(token) as Record<string, unknown>)
};

function verificationTokenFor(userId: string, phone = '+5511988887777'): string {
    return JSON.stringify({
        typ: 'student_profile_update',
        sub: userId,
        ph: phone
    });
}

const schoolPersonaForbidden = {
    code: ErrorCode.SCHOOL_PERSONA_STUDENT_PROFILE_UPDATE_FORBIDDEN
};

describe('Rotas de perfil do aluno — persona SCHOOL (KYC Asaas)', () => {
    it('bloqueia PUT mesmo com token OTP aparentemente válido (antes da verificação de OTP)', async () => {
        const users = new InMemoryUserRepository();
        const user = makeUser(UserPersonaEnum.SCHOOL);
        users.seed(user);

        const useCase = new UpdateStudentProfile(users, tokenProvider);
        await expect(
            useCase.exec({
                userId: user.id,
                profileUpdateVerificationToken: verificationTokenFor(user.id),
                email: 'outro@escola.com'
            })
        ).rejects.toMatchObject(schoolPersonaForbidden);
    });

    it('bloqueia PUT de perfil para qualquer campo', async () => {
        const users = new InMemoryUserRepository();
        const user = makeUser(UserPersonaEnum.SCHOOL);
        users.seed(user);

        const useCase = new UpdateStudentProfile(users, tokenProvider);
        const token = verificationTokenFor(user.id);

        await expect(
            useCase.exec({
                userId: user.id,
                profileUpdateVerificationToken: token,
                fullName: 'Novo Nome'
            })
        ).rejects.toMatchObject(schoolPersonaForbidden);

        await expect(
            useCase.exec({
                userId: user.id,
                profileUpdateVerificationToken: verificationTokenFor(user.id, '+5511977776666'),
                email: 'novo@escola.com',
                phone: '11977776666',
                address: {
                    street: 'Rua B',
                    number: '99',
                    city: 'São Paulo',
                    state: 'SP',
                    zipCode: '02000000'
                }
            })
        ).rejects.toMatchObject(schoolPersonaForbidden);
    });

    it('aluno com persona STUDENT continua podendo alterar nome e sexo', async () => {
        const users = new InMemoryUserRepository();
        const user = makeUser(UserPersonaEnum.STUDENT);
        users.seed(user);

        const useCase = new UpdateStudentProfile(users, tokenProvider);
        const updated = await useCase.exec({
            userId: user.id,
            profileUpdateVerificationToken: verificationTokenFor(user.id),
            fullName: 'João Atualizado',
            gender: 'FEMALE'
        });

        expect(updated.fullName).toBe('João Atualizado');
        expect(updated.gender).toBe('FEMALE');
    });

    it('rejeita cpf e birthDate para qualquer aluno', async () => {
        const users = new InMemoryUserRepository();
        const user = makeUser(UserPersonaEnum.STUDENT);
        users.seed(user);

        const useCase = new UpdateStudentProfile(users, tokenProvider);

        await expect(
            useCase.exec({
                userId: user.id,
                profileUpdateVerificationToken: verificationTokenFor(user.id),
                cpf: '98765432100'
            })
        ).rejects.toBeInstanceOf(AppError);
    });
});
