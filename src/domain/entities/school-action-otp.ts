export type SchoolActionOtpPurpose = 'WITHDRAWAL' | 'BANK_ACCOUNT_CHANGE';

export class SchoolActionOtp {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly purpose: SchoolActionOtpPurpose,
        public readonly code: string,
        public readonly phone: string,
        public readonly expiresAt: Date,
        public readonly attemptsUsed: number,
        public readonly maxAttempts: number,
        public readonly verifiedAt: Date | null,
        public readonly consumedAt: Date | null,
        public readonly createdAt: Date
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        purpose: SchoolActionOtpPurpose;
        code: string;
        phone: string;
        expiresAt: Date;
        attemptsUsed?: number;
        maxAttempts?: number;
        verifiedAt?: Date | null;
        consumedAt?: Date | null;
        createdAt?: Date;
    }): SchoolActionOtp {
        const id = params.id.trim();
        const schoolId = params.schoolId.trim();
        const code = params.code.trim();
        const phone = params.phone.trim();

        if (!id) throw new Error('School action otp id is required');
        if (!schoolId) throw new Error('School action otp schoolId is required');
        if (!/^\d{4,8}$/.test(code)) throw new Error('School action otp code is invalid');
        if (!phone) throw new Error('School action otp phone is required');

        return new SchoolActionOtp(
            id,
            schoolId,
            params.purpose,
            code,
            phone,
            params.expiresAt,
            params.attemptsUsed ?? 0,
            params.maxAttempts ?? 5,
            params.verifiedAt ?? null,
            params.consumedAt ?? null,
            params.createdAt ?? new Date()
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

    registerAttempt(success: boolean, when = new Date()): SchoolActionOtp {
        return SchoolActionOtp.create({
            id: this.id,
            schoolId: this.schoolId,
            purpose: this.purpose,
            code: this.code,
            phone: this.phone,
            expiresAt: this.expiresAt,
            attemptsUsed: this.attemptsUsed + 1,
            maxAttempts: this.maxAttempts,
            verifiedAt: success ? when : this.verifiedAt,
            consumedAt: this.consumedAt,
            createdAt: this.createdAt
        });
    }

    consume(when = new Date()): SchoolActionOtp {
        return SchoolActionOtp.create({
            id: this.id,
            schoolId: this.schoolId,
            purpose: this.purpose,
            code: this.code,
            phone: this.phone,
            expiresAt: this.expiresAt,
            attemptsUsed: this.attemptsUsed,
            maxAttempts: this.maxAttempts,
            verifiedAt: this.verifiedAt,
            consumedAt: when,
            createdAt: this.createdAt
        });
    }
}
