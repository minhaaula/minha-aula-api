import type { AuthPhoneOtpChallenge } from '../../domain/entities/auth-phone-otp-challenge';

export interface AuthPhoneOtpChallengeRepository {
    save(challenge: AuthPhoneOtpChallenge): Promise<void>;
    findById(id: string): Promise<AuthPhoneOtpChallenge | null>;
}
