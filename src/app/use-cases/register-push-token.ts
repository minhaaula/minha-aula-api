import { UserRepository } from '../../ports/repositories/user.repo';
import { PushTokenRepository, PushPlatform } from '../../ports/repositories/push-token.repo';

export class RegisterPushToken {
    constructor(
        private readonly users: UserRepository,
        private readonly tokens: PushTokenRepository
    ) {}

    async exec(input: { userId: string; token: string; platform?: PushPlatform | null }): Promise<{ tokenId: string }> {
        const userId = input.userId.trim();
        const token = input.token.trim();
        if (!userId) throw new Error('userId is required');
        if (!token) throw new Error('token is required');

        const user = await this.users.findById(userId);
        if (!user) throw new Error('User not found');

        const saved = await this.tokens.upsert({ userId, token, platform: input.platform ?? 'UNKNOWN' });
        return { tokenId: saved.id };
    }
}

