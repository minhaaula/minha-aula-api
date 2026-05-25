import { PasswordResetTokenRepository } from '../../../ports/repositories/password-reset-token.repo';

type ValidatePasswordResetTokenInput = {
    token: string;
};

type ValidatePasswordResetTokenOutput = {
    valid: boolean;
    email?: string;
    expiresAt?: Date;
};

export class ValidatePasswordResetToken {
    constructor(private readonly resetTokens: PasswordResetTokenRepository) {}

    async exec(input: ValidatePasswordResetTokenInput): Promise<ValidatePasswordResetTokenOutput> {
        const { token } = input;

        if (!token || !token.trim()) {
            return { valid: false };
        }

        const resetToken = await this.resetTokens.findByToken(token);

        if (!resetToken) {
            return { valid: false };
        }

        // Verificar se o token é válido (não usado e não expirado)
        if (!resetToken.isValid()) {
            return { valid: false };
        }

        return {
            valid: true,
            email: resetToken.email,
            expiresAt: resetToken.expiresAt
        };
    }
}

