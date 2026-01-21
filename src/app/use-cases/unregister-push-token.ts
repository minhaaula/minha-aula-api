import { PushTokenRepository } from '../../ports/repositories/push-token.repo';

export class UnregisterPushToken {
    constructor(private readonly tokens: PushTokenRepository) {}

    async exec(input: { userId: string; token: string }): Promise<{ revoked: boolean }> {
        const userId = input.userId.trim();
        const token = input.token.trim();
        if (!userId) throw new Error('userId is required');
        if (!token) throw new Error('token is required');

        // revoke por token (o repo garante unicidade do token)
        const affected = await this.tokens.revokeByTokens([token]);
        return { revoked: affected > 0 };
    }
}

