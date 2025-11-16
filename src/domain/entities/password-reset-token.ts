export class PasswordResetToken {
    private constructor(
        public readonly id: string,
        public readonly email: string,
        public readonly token: string,
        public readonly expiresAt: Date,
        public readonly used: boolean,
        public readonly createdAt: Date
    ) {}

    static create(params: {
        id: string;
        email: string;
        token: string;
        expiresAt: Date;
        used?: boolean;
        createdAt?: Date;
    }): PasswordResetToken {
        const id = params.id.trim();
        if (!id) throw new Error('Password reset token id is required');

        const email = params.email.trim().toLowerCase();
        if (!email) throw new Error('Email is required');

        const token = params.token.trim();
        if (!token) throw new Error('Token is required');

        const used = params.used ?? false;
        const createdAt = params.createdAt ?? new Date();

        return new PasswordResetToken(
            id,
            email,
            token,
            params.expiresAt,
            used,
            createdAt
        );
    }

    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    isValid(): boolean {
        return !this.used && !this.isExpired();
    }
}

