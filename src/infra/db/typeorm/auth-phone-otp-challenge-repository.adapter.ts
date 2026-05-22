import { AuthPhoneOtpChallenge, type AuthPhoneOtpPurpose } from '../../../domain/entities/auth-phone-otp-challenge';
import { AuthPhoneOtpChallengeRepository } from '../../../ports/repositories/auth-phone-otp-challenge.repo';
import { AppDataSource } from './datasource';
import { AuthPhoneOtpChallengeOrm } from './entities/auth-phone-otp-challenge.orm';

export class AuthPhoneOtpChallengeRepositoryAdapter implements AuthPhoneOtpChallengeRepository {
    private readonly repo = AppDataSource.getRepository(AuthPhoneOtpChallengeOrm);

    async save(challenge: AuthPhoneOtpChallenge): Promise<void> {
        const existing = await this.repo.findOne({ where: { id: challenge.id } });
        const row = existing ?? new AuthPhoneOtpChallengeOrm();
        row.id = challenge.id;
        row.purpose = challenge.purpose;
        row.code = challenge.code;
        row.phone = challenge.phone;
        row.email = challenge.email;
        row.subjectUserId = challenge.subjectUserId;
        row.expiresAt = challenge.expiresAt;
        row.attemptsUsed = challenge.attemptsUsed;
        row.maxAttempts = challenge.maxAttempts;
        row.verifiedAt = challenge.verifiedAt;
        row.consumedAt = challenge.consumedAt;
        row.createdAt = challenge.createdAt;
        row.twilioVerificationSid = challenge.twilioVerificationSid;
        await this.repo.save(row);
    }

    async findById(id: string): Promise<AuthPhoneOtpChallenge | null> {
        const normalized = id.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({ where: { id: normalized } });
        return row ? this.toDomain(row) : null;
    }

    private toDomain(row: AuthPhoneOtpChallengeOrm): AuthPhoneOtpChallenge {
        return AuthPhoneOtpChallenge.create({
            id: row.id,
            purpose: row.purpose as AuthPhoneOtpPurpose,
            code: row.code,
            phone: row.phone,
            email: row.email,
            subjectUserId: row.subjectUserId ?? null,
            expiresAt: row.expiresAt,
            attemptsUsed: row.attemptsUsed,
            maxAttempts: row.maxAttempts,
            verifiedAt: row.verifiedAt,
            consumedAt: row.consumedAt,
            createdAt: row.createdAt,
            twilioVerificationSid: row.twilioVerificationSid ?? null
        });
    }
}
