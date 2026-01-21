export type PushPlatform = 'ANDROID' | 'IOS' | 'WEB' | 'UNKNOWN';

export type PushToken = {
    id: string;
    userId: string;
    token: string;
    platform: PushPlatform;
    createdAt: Date;
    lastSeenAt: Date;
    revokedAt: Date | null;
};

export interface PushTokenRepository {
    upsert(input: { userId: string; token: string; platform?: PushPlatform | null }): Promise<PushToken>;
    listActiveByUserIds(userIds: string[]): Promise<Array<{ userId: string; token: string }>>;
    revokeByTokens(tokens: string[], revokedAt?: Date): Promise<number>;
}

