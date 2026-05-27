export type AppClientPlatform = 'ANDROID' | 'IOS';

export type UserAppClientStateRecord = {
    userId: string;
    platform: AppClientPlatform;
    appVersion: string;
    osVersion: string;
    notificationsEnabled: boolean;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
};

export type UpsertUserAppClientStateInput = {
    userId: string;
    platform: AppClientPlatform;
    appVersion: string;
    osVersion: string;
    notificationsEnabled: boolean;
    lastSeenAt?: Date;
};

export type AppClientVersionCount = {
    appVersion: string;
    count: number;
};

export type AppClientOsVersionCount = {
    osVersion: string;
    count: number;
};

export type AppClientConsolidatedStats = {
    totalUsers: number;
    appVersions: AppClientVersionCount[];
    byPlatform: {
        ANDROID: number;
        IOS: number;
    };
    osVersionsByPlatform: {
        ANDROID: AppClientOsVersionCount[];
        IOS: AppClientOsVersionCount[];
    };
};

export interface UserAppClientStateRepository {
    upsert(input: UpsertUserAppClientStateInput): Promise<UserAppClientStateRecord>;
    findByUserId?(userId: string): Promise<UserAppClientStateRecord | null>;
    getConsolidatedStats?(): Promise<AppClientConsolidatedStats>;
}
