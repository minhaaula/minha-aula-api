import { AppDataSource } from './datasource';
import {
    type AppClientConsolidatedStats,
    type AppClientOsVersionCount,
    type AppClientPlatform,
    type AppClientVersionCount,
    type UpsertUserAppClientStateInput,
    type UserAppClientStateRecord,
    UserAppClientStateRepository
} from '../../../ports/repositories/user-app-client-state.repo';
import { UserAppClientStateOrm } from './entities/user-app-client-state.orm';
import { coerceToDate } from '../../../shared/date-utils';

export class UserAppClientStateRepositoryAdapter implements UserAppClientStateRepository {
    private readonly repo = AppDataSource.getRepository(UserAppClientStateOrm);

    async upsert(input: UpsertUserAppClientStateInput): Promise<UserAppClientStateRecord> {
        const userId = input.userId.trim();
        const lastSeenAt = input.lastSeenAt ?? new Date();

        const existing = await this.repo.findOne({ where: { userId } });
        const row = existing ?? this.repo.create({ userId });

        row.platform = input.platform;
        row.appVersion = input.appVersion.trim();
        row.osVersion = input.osVersion.trim();
        row.notificationsEnabled = input.notificationsEnabled;
        row.lastSeenAt = lastSeenAt;

        const saved = await this.repo.save(row);
        return this.toRecord(saved);
    }

    async findByUserId(userId: string): Promise<UserAppClientStateRecord | null> {
        const row = await this.repo.findOne({ where: { userId: userId.trim() } });
        return row ? this.toRecord(row) : null;
    }

    async getConsolidatedStats(): Promise<AppClientConsolidatedStats> {
        const rows = await this.repo.find({
            select: {
                platform: true,
                appVersion: true,
                osVersion: true
            }
        });

        return buildAppClientConsolidatedStats(rows);
    }

    private toRecord(row: UserAppClientStateOrm): UserAppClientStateRecord {
        return {
            userId: row.userId,
            platform: row.platform as AppClientPlatform,
            appVersion: row.appVersion,
            osVersion: row.osVersion,
            notificationsEnabled: Boolean(row.notificationsEnabled),
            lastSeenAt: coerceToDate(row.lastSeenAt) ?? new Date(),
            createdAt: coerceToDate(row.createdAt) ?? new Date(),
            updatedAt: coerceToDate(row.updatedAt) ?? new Date()
        };
    }
}

type AppClientConsolidatedRow = {
    platform: AppClientPlatform | string;
    appVersion: string;
    osVersion: string;
};

export function buildAppClientConsolidatedStats(rows: AppClientConsolidatedRow[]): AppClientConsolidatedStats {
    const versionMap = new Map<string, number>();
    const byPlatform = { ANDROID: 0, IOS: 0 };
    const osByPlatform = {
        ANDROID: new Map<string, number>(),
        IOS: new Map<string, number>()
    };

    for (const row of rows) {
        if (row.platform === 'ANDROID') {
            byPlatform.ANDROID += 1;
        } else if (row.platform === 'IOS') {
            byPlatform.IOS += 1;
        }

        const appVersion = row.appVersion.trim();
        if (appVersion) {
            versionMap.set(appVersion, (versionMap.get(appVersion) ?? 0) + 1);
        }

        const osVersion = row.osVersion.trim();
        if (!osVersion) {
            continue;
        }
        if (row.platform === 'ANDROID') {
            osByPlatform.ANDROID.set(osVersion, (osByPlatform.ANDROID.get(osVersion) ?? 0) + 1);
        } else if (row.platform === 'IOS') {
            osByPlatform.IOS.set(osVersion, (osByPlatform.IOS.get(osVersion) ?? 0) + 1);
        }
    }

    return {
        totalUsers: rows.length,
        appVersions: sortVersionCounts(versionMap),
        byPlatform,
        osVersionsByPlatform: {
            ANDROID: sortOsVersionCounts(osByPlatform.ANDROID),
            IOS: sortOsVersionCounts(osByPlatform.IOS)
        }
    };
}

function sortVersionCounts(map: Map<string, number>): AppClientVersionCount[] {
    return [...map.entries()]
        .map(([appVersion, count]) => ({ appVersion, count }))
        .sort((a, b) => b.count - a.count || a.appVersion.localeCompare(b.appVersion));
}

function sortOsVersionCounts(map: Map<string, number>): AppClientOsVersionCount[] {
    return [...map.entries()]
        .map(([osVersion, count]) => ({ osVersion, count }))
        .sort((a, b) => b.count - a.count || a.osVersion.localeCompare(b.osVersion));
}
