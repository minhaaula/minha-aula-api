import { PasswordResetToken } from '../../domain/entities/password-reset-token';

export interface PasswordResetTokenRepository {
    save(token: PasswordResetToken): Promise<void>;
    findByToken(token: string): Promise<PasswordResetToken | null>;
    markAsUsed(token: string): Promise<void>;
    deleteExpired(): Promise<void>;
}

