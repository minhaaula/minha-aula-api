import { UserRepository } from '../../ports/repositories/user.repo';
import { PushTokenRepository, PushPlatform } from '../../ports/repositories/push-token.repo';
import { AppError, ErrorCode } from '../../shared/errors';

export class RegisterPushToken {
    constructor(
        private readonly users: UserRepository,
        private readonly tokens: PushTokenRepository
    ) {}

    async exec(input: { userId: string; token: string; platform?: PushPlatform | null }): Promise<{ tokenId: string }> {
        const userId = input.userId.trim();
        const token = input.token.trim();
        if (!userId) throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'userId' });
        if (!token) throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'token' });

        const user = await this.users.findById(userId);
        if (!user) throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId });

        const saved = await this.tokens.upsert({ userId, token, platform: input.platform ?? 'UNKNOWN' });
        return { tokenId: saved.id };
    }
}

