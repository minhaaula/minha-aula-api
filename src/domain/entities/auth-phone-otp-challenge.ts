export type AuthPhoneOtpPurpose = 'signup' | 'school_signup' | 'user_password_reset' | 'school_password_reset';

/** Quando Twilio Verify envia o OTP, o código real não fica no banco. */
export class AuthPhoneOtpChallenge {
    private constructor(
        public readonly id: string,
        public readonly purpose: AuthPhoneOtpPurpose,
        public readonly code: string,
        public readonly phone: string,
        public readonly email: string | null,
        public readonly expiresAt: Date,
        public readonly attemptsUsed: number,
        public readonly maxAttempts: number,
        public readonly verifiedAt: Date | null,
        public readonly consumedAt: Date | null,
        public readonly createdAt: Date,
        public readonly twilioVerificationSid: string | null
    ) {}

    static create(params: {
        id: string;
        purpose: AuthPhoneOtpPurpose;
        code: string;
        phone: string;
        email?: string | null;
        expiresAt: Date;
        attemptsUsed?: number;
        maxAttempts?: number;
        verifiedAt?: Date | null;
        consumedAt?: Date | null;
        createdAt?: Date;
        twilioVerificationSid?: string | null;
    }): AuthPhoneOtpChallenge {
        const id = params.id.trim();
        const code = params.code.trim();
        const phone = params.phone.trim();
        if (!id) throw new Error('Auth phone OTP id is required');
        if (!/^\d{4,8}$/.test(code)) throw new Error('Auth phone OTP code is invalid');
        if (!phone) throw new Error('Auth phone OTP phone is required');

        return new AuthPhoneOtpChallenge(
            id,
            params.purpose,
            code,
            phone,
            params.email?.trim().toLowerCase() ?? null,
            params.expiresAt,
            params.attemptsUsed ?? 0,
            params.maxAttempts ?? 5,
            params.verifiedAt ?? null,
            params.consumedAt ?? null,
            params.createdAt ?? new Date(),
            params.twilioVerificationSid?.trim() ? params.twilioVerificationSid.trim() : null
        );
    }

    isExpired(now = new Date()): boolean {
        return this.expiresAt.getTime() < now.getTime();
    }

    isVerified(): boolean {
        return this.verifiedAt !== null;
    }

    isConsumed(): boolean {
        return this.consumedAt !== null;
    }

    canAttempt(): boolean {
        return !this.isConsumed() && !this.isExpired() && this.attemptsUsed < this.maxAttempts;
    }

    registerAttempt(success: boolean, when = new Date()): AuthPhoneOtpChallenge {
        return AuthPhoneOtpChallenge.create({
            id: this.id,
            purpose: this.purpose,
            code: this.code,
            phone: this.phone,
            email: this.email,
            expiresAt: this.expiresAt,
            attemptsUsed: this.attemptsUsed + 1,
            maxAttempts: this.maxAttempts,
            verifiedAt: success ? when : this.verifiedAt,
            consumedAt: this.consumedAt,
            createdAt: this.createdAt,
            twilioVerificationSid: this.twilioVerificationSid
        });
    }

    markConsumed(when = new Date()): AuthPhoneOtpChallenge {
        return AuthPhoneOtpChallenge.create({
            id: this.id,
            purpose: this.purpose,
            code: this.code,
            phone: this.phone,
            email: this.email,
            expiresAt: this.expiresAt,
            attemptsUsed: this.attemptsUsed,
            maxAttempts: this.maxAttempts,
            verifiedAt: this.verifiedAt,
            consumedAt: when,
            createdAt: this.createdAt,
            twilioVerificationSid: this.twilioVerificationSid
        });
    }
}
