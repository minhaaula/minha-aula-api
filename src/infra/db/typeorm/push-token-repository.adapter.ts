import { AppDataSource } from './datasource';
import { PushTokenRepository, PushPlatform, PushToken } from '../../../ports/repositories/push-token.repo';
import { UserPushTokenOrm } from './entities/user-push-token.orm';
import { Uuid } from '../../../shared/uuid';

export class PushTokenRepositoryAdapter implements PushTokenRepository {
    private readonly repo = AppDataSource.getRepository(UserPushTokenOrm);

    async upsert(input: { userId: string; token: string; platform?: PushPlatform | null }): Promise<PushToken> {
        const userId = input.userId.trim();
        const token = input.token.trim();
        if (!userId) throw new Error('userId is required');
        if (!token) throw new Error('token is required');

        const platform = (input.platform ?? 'UNKNOWN') as PushPlatform;

        const existing = await this.repo.findOne({ where: { token } });
        const row = existing ?? new UserPushTokenOrm();

        row.id = existing?.id ?? Uuid();
        row.userId = userId;
        row.token = token;
        row.platform = platform;
        row.revokedAt = null;

        // lastSeenAt é UpdateDateColumn, mas garantir update mesmo se row já existe
        row.lastSeenAt = new Date();

        await this.repo.save(row);
        return this.toDomain(row);
    }

    async listActiveByUserIds(userIds: string[]): Promise<Array<{ userId: string; token: string }>> {
        const ids = userIds.map((id) => id.trim()).filter(Boolean);
        if (!ids.length) return [];

        const rows = await this.repo
            .createQueryBuilder('t')
            .select(['t.userId AS userId', 't.token AS token'])
            .where('t.userId IN (:...ids)', { ids })
            .andWhere('t.revokedAt IS NULL')
            .getRawMany<{ userId: string; token: string }>();

        return rows.map((r) => ({ userId: r.userId, token: r.token }));
    }

    async revokeByTokens(tokens: string[], revokedAt: Date = new Date()): Promise<number> {
        const list = tokens.map((t) => t.trim()).filter(Boolean);
        if (!list.length) return 0;

        const result = await this.repo
            .createQueryBuilder()
            .update(UserPushTokenOrm)
            .set({ revokedAt })
            .where('token IN (:...tokens)', { tokens: list })
            .execute();

        return result.affected ?? 0;
    }

    private toDomain(row: UserPushTokenOrm): PushToken {
        return {
            id: row.id,
            userId: row.userId,
            token: row.token,
            platform: row.platform,
            createdAt: row.createdAt,
            lastSeenAt: row.lastSeenAt,
            revokedAt: row.revokedAt
        };
    }
}

