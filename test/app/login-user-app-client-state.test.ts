import { describe, expect, it } from 'vitest';
import { LoginUser } from '../../src/app/use-cases/auth/login-user';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';
import type { UserRepository } from '../../src/ports/repositories/user.repo';
import type {
    UpsertUserAppClientStateInput,
    UserAppClientStateRepository,
    UserAppClientStateRecord
} from '../../src/ports/repositories/user-app-client-state.repo';
import type { PasswordHasherPort } from '../../src/ports/providers/password-hasher.port';
import type { TokenProviderPort } from '../../src/ports/providers/token-provider.port';

class TestHasher implements PasswordHasherPort {
    async hash(p: string) {
        return `hash:${p}`;
    }
    async compare(p: string, h: string) {
        return h === `hash:${p}`;
    }
}

class TestTokens implements TokenProviderPort {
    async sign() {
        return 'token';
    }
    async verify() {
        return {};
    }
}

class InMemoryUsers implements Pick<UserRepository, 'findByCpf'> {
    constructor(private readonly user: User) {}
    async findByCpf() {
        return this.user;
    }
}

class InMemoryAppClientState implements UserAppClientStateRepository {
    lastUpsert: UpsertUserAppClientStateInput | null = null;

    async upsert(input: UpsertUserAppClientStateInput): Promise<UserAppClientStateRecord> {
        this.lastUpsert = input;
        const lastSeenAt = input.lastSeenAt ?? new Date();
        return {
            userId: input.userId,
            platform: input.platform,
            appVersion: input.appVersion,
            osVersion: input.osVersion,
            notificationsEnabled: input.notificationsEnabled,
            lastSeenAt,
            createdAt: lastSeenAt,
            updatedAt: lastSeenAt
        };
    }
}

function makeStudent() {
    return User.create({
        id: 'user-1',
        fullName: 'Aluno Teste',
        birthDate: new Date('1990-01-01'),
        email: Email.create('aluno@test.com'),
        phone: '11999999999',
        cpf: '12345678909',
        address: PostalAddress.create({
            street: 'Rua A',
            number: '1',
            city: 'SP',
            state: 'SP',
            zipCode: '01000000'
        }),
        persona: UserPersonaEnum.STUDENT,
        passwordHash: 'hash:senha12345'
    });
}

describe('LoginUser — app client state', () => {
    it('grava metadados do app na tabela user_app_client_state após login', async () => {
        const appState = new InMemoryAppClientState();
        const login = new LoginUser(
            new InMemoryUsers(makeStudent()) as UserRepository,
            new TestHasher(),
            new TestTokens(),
            3600,
            ['students'],
            undefined,
            appState
        );

        await login.exec({
            cpf: '123.456.789-09',
            password: 'senha12345',
            appClient: {
                platform: 'ANDROID',
                appVersion: '2.1.3',
                osVersion: 'Android 14',
                notificationsEnabled: true
            }
        });

        expect(appState.lastUpsert).toMatchObject({
            userId: 'user-1',
            platform: 'ANDROID',
            appVersion: '2.1.3',
            osVersion: 'Android 14',
            notificationsEnabled: true
        });
        expect(appState.lastUpsert?.lastSeenAt).toBeInstanceOf(Date);
    });

    it('não grava app client quando campos não são enviados', async () => {
        const appState = new InMemoryAppClientState();
        const login = new LoginUser(
            new InMemoryUsers(makeStudent()) as UserRepository,
            new TestHasher(),
            new TestTokens(),
            3600,
            ['students'],
            undefined,
            appState
        );

        await login.exec({ cpf: '12345678909', password: 'senha12345' });
        expect(appState.lastUpsert).toBeNull();
    });
});
