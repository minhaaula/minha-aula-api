import { LessThan } from 'typeorm';
import { AppDataSource } from './datasource';
import { PasswordResetTokenRepository } from '../../../ports/repositories/password-reset-token.repo';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token';
import { PasswordResetTokenOrm } from './entities/password-reset-token.orm';

export class PasswordResetTokenRepositoryAdapter implements PasswordResetTokenRepository {
    private readonly repo = AppDataSource.getRepository(PasswordResetTokenOrm);

    async save(token: PasswordResetToken): Promise<void> {
        const orm = new PasswordResetTokenOrm();
        orm.id = token.id;
        orm.email = token.email;
        orm.token = token.token;
        orm.expiresAt = token.expiresAt;
        orm.used = token.used ? 1 : 0;
        orm.createdAt = token.createdAt;

        await this.repo.save(orm);
    }

    async findByToken(token: string): Promise<PasswordResetToken | null> {
        const normalized = token.trim();
        if (!normalized) return null;

        const row = await this.repo.findOne({ where: { token: normalized } });
        return row ? this.toDomain(row) : null;
    }

    async markAsUsed(token: string): Promise<void> {
        await this.repo.update({ token }, { used: 1 });
    }

    async deleteExpired(): Promise<void> {
        await this.repo.delete({ expiresAt: LessThan(new Date()) });
    }

    private toDomain(row: PasswordResetTokenOrm): PasswordResetToken {
        return PasswordResetToken.create({
            id: row.id,
            email: row.email,
            token: row.token,
            expiresAt: row.expiresAt,
            used: row.used === 1,
            createdAt: row.createdAt
        });
    }
}

