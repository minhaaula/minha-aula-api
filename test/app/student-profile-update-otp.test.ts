import { describe, expect, it, vi } from 'vitest';
import { RequestStudentProfileUpdateOtp } from '../../src/app/use-cases/students/request-student-profile-update-otp';
import { VerifyStudentProfileUpdateOtp } from '../../src/app/use-cases/students/verify-student-profile-update-otp';
import { UpdateStudentProfile } from '../../src/app/use-cases/students/update-student-profile';
import { AuthPhoneOtpChallenge } from '../../src/domain/entities/auth-phone-otp-challenge';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';
import type { AuthPhoneOtpChallengeRepository } from '../../src/ports/repositories/auth-phone-otp-challenge.repo';
import type { UserRepository } from '../../src/ports/repositories/user.repo';
import type { OutboxRepository } from '../../src/ports/repositories/outbox.repo';
import type { TwilioVerifyPort } from '../../src/ports/providers/twilio-verify.port';
import type { TokenProviderPort } from '../../src/ports/providers/token-provider.port';
import { AppError, ErrorCode } from '../../src/shared/errors';
import { toE164Brazil } from '../../src/shared/phone-e164';
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

class InMemoryAuthPhoneOtpRepository implements AuthPhoneOtpChallengeRepository {
    private readonly items = new Map<string, AuthPhoneOtpChallenge>();

    async save(challenge: AuthPhoneOtpChallenge): Promise<void> {
        this.items.set(challenge.id, challenge);
    }

    async findById(id: string): Promise<AuthPhoneOtpChallenge | null> {
        return this.items.get(id) ?? null;
    }
}

class FakeOutbox implements OutboxRepository {
    readonly events: Array<{ type: string; aggregateId: string }> = [];

    async enqueue(event: { type: string; aggregateId: string }): Promise<void> {
        this.events.push({ type: event.type, aggregateId: event.aggregateId });
    }
}

const fakeTwilio: TwilioVerifyPort = {
    sendVerification: vi.fn(async () => ({ verificationSid: 'VE123' })),
    checkVerification: vi.fn(async (_phone: string, code: string) => code === '123456')
};

function makeStudentUser(phone = '11999999999'): User {
    const id = Uuid();
    return User.create({
        id,
        fullName: 'Maria Silva',
        birthDate: new Date('1990-01-15'),
        email: Email.create('maria@email.com'),
        phone,
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
        persona: UserPersonaEnum.STUDENT,
        passwordHash: 'hash',
        createdAt: new Date(),
        active: true,
        deactivationReason: null,
        deactivationDescription: null,
        photoStorageKey: null,
        studentAccessEnabled: true,
        gender: 'FEMALE'
    });
}

describe('Student profile update OTP', () => {
    it('envia OTP para o novo WhatsApp quando phone é informado na solicitação', async () => {
        const users = new InMemoryUserRepository();
        const challenges = new InMemoryAuthPhoneOtpRepository();
        const outbox = new FakeOutbox();
        const user = makeStudentUser('11988887777');
        users.seed(user);

        const useCase = new RequestStudentProfileUpdateOtp(challenges, users, fakeTwilio, outbox);
        const result = await useCase.exec({
            userId: user.id,
            phone: '11977776666'
        });

        const expectedPhone = toE164Brazil('11977776666');
        expect(result.phone).toBe(expectedPhone);
        expect(result.purpose).toBe('student_profile_update');
        expect(outbox.events).toHaveLength(1);
        expect(outbox.events[0]?.type).toBe('phone_otp_send');

        const saved = await challenges.findById(result.challengeId);
        expect(saved?.phone).toBe(expectedPhone);
        expect(saved?.subjectUserId).toBe(user.id);
    });

    it('envia OTP para o WhatsApp atual quando phone não é informado', async () => {
        const users = new InMemoryUserRepository();
        const challenges = new InMemoryAuthPhoneOtpRepository();
        const outbox = new FakeOutbox();
        const user = makeStudentUser('11988887777');
        users.seed(user);

        const useCase = new RequestStudentProfileUpdateOtp(challenges, users, fakeTwilio, outbox);
        const result = await useCase.exec({ userId: user.id });

        expect(result.phone).toBe(toE164Brazil('11988887777'));
    });

    it('verifica código e emite token; PUT exige token e aceita troca de phone', async () => {
        const users = new InMemoryUserRepository();
        const challenges = new InMemoryAuthPhoneOtpRepository();
        const outbox = new FakeOutbox();
        const user = makeStudentUser('11988887777');
        users.seed(user);

        const requestOtp = new RequestStudentProfileUpdateOtp(challenges, users, fakeTwilio, outbox);
        const requested = await requestOtp.exec({
            userId: user.id,
            phone: '11977776666'
        });

        const challengeId = requested.challengeId;
        const withSid = AuthPhoneOtpChallenge.create({
            id: challengeId,
            purpose: 'student_profile_update',
            code: '000000',
            phone: requested.phone,
            email: null,
            subjectUserId: user.id,
            expiresAt: new Date(Date.now() + 600_000),
            twilioVerificationSid: 'VE123'
        });
        await challenges.save(withSid);

        const tokenProvider: TokenProviderPort = {
            sign: vi.fn(async (payload) => JSON.stringify(payload)),
            verify: vi.fn(async (token) => JSON.parse(token) as Record<string, unknown>)
        };

        const verifyOtp = new VerifyStudentProfileUpdateOtp(challenges, fakeTwilio, tokenProvider);
        const verified = await verifyOtp.exec({
            userId: user.id,
            challengeId,
            code: '123456'
        });

        expect(verified.profileUpdateVerificationToken).toBeTruthy();
        expect(verified.verifiedPhone).toBe(toE164Brazil('11977776666'));

        const updateProfile = new UpdateStudentProfile(users, tokenProvider);
        const updated = await updateProfile.exec({
            userId: user.id,
            profileUpdateVerificationToken: verified.profileUpdateVerificationToken,
            phone: '11977776666',
            fullName: 'Maria Atualizada'
        });

        expect(updated.fullName).toBe('Maria Atualizada');
        expect(updated.phone).toBe('11977776666');
    });

    it('rejeita PUT sem token de verificação válido', async () => {
        const users = new InMemoryUserRepository();
        const user = makeStudentUser();
        users.seed(user);

        const tokenProvider: TokenProviderPort = {
            sign: vi.fn(async () => 'token'),
            verify: vi.fn(async () => {
                throw new Error('invalid');
            })
        };

        const updateProfile = new UpdateStudentProfile(users, tokenProvider);
        await expect(
            updateProfile.exec({
                userId: user.id,
                profileUpdateVerificationToken: 'invalid',
                fullName: 'X'
            })
        ).rejects.toMatchObject({ code: ErrorCode.STUDENT_PROFILE_NOT_VERIFIED });
    });

    it('rejeita verificação se challenge pertence a outro usuário', async () => {
        const users = new InMemoryUserRepository();
        const challenges = new InMemoryAuthPhoneOtpRepository();
        const user = makeStudentUser();
        const other = makeStudentUser('11888887777');
        users.seed(user);
        users.seed(other);

        const otp = AuthPhoneOtpChallenge.create({
            id: Uuid(),
            purpose: 'student_profile_update',
            code: '000000',
            phone: toE164Brazil(user.phone),
            email: null,
            subjectUserId: user.id,
            expiresAt: new Date(Date.now() + 600_000),
            twilioVerificationSid: 'VE123'
        });
        await challenges.save(otp);

        const tokenProvider: TokenProviderPort = {
            sign: vi.fn(async () => 't'),
            verify: vi.fn(async () => ({}))
        };

        const verifyOtp = new VerifyStudentProfileUpdateOtp(challenges, fakeTwilio, tokenProvider);
        await expect(
            verifyOtp.exec({
                userId: other.id,
                challengeId: otp.id,
                code: '123456'
            })
        ).rejects.toBeInstanceOf(AppError);
    });
});
