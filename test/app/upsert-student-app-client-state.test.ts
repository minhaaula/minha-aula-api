import { describe, expect, it } from 'vitest';
import { UpsertStudentAppClientState } from '../../src/app/use-cases/students/upsert-student-app-client-state';
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

class InMemoryUsers implements Pick<UserRepository, 'findById'> {
    constructor(private readonly user: User) {}
    async findById() {
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
        fullName: 'Aluno',
        birthDate: new Date('1990-01-01'),
        email: Email.create('aluno@test.com'),
        phone: '11999999999',
        cpf: '39588620805',
        address: PostalAddress.create({
            street: 'Rua A',
            number: '1',
            city: 'SP',
            state: 'SP',
            zipCode: '01000000'
        }),
        persona: UserPersonaEnum.STUDENT,
        passwordHash: 'hash'
    });
}

describe('UpsertStudentAppClientState', () => {
    it('grava metadados do app para o usuário autenticado', async () => {
        const appState = new InMemoryAppClientState();
        const useCase = new UpsertStudentAppClientState(
            new InMemoryUsers(makeStudent()) as UserRepository,
            appState
        );

        await useCase.exec({
            userId: 'user-1',
            appClient: {
                platform: 'IOS',
                appVersion: '2.1.3',
                osVersion: 'iOS 26.2',
                notificationsEnabled: false
            }
        });

        expect(appState.lastUpsert).toMatchObject({
            userId: 'user-1',
            platform: 'IOS',
            appVersion: '2.1.3',
            osVersion: 'iOS 26.2',
            notificationsEnabled: false
        });
    });
});
