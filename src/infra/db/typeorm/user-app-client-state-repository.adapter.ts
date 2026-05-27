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

        await this.repo.upsert(
            {
                userId,
                platform: input.platform,
                appVersion: input.appVersion.trim(),
                osVersion: input.osVersion.trim(),
                notificationsEnabled: input.notificationsEnabled,
                lastSeenAt
            },
            ['userId']
        );

        const row = await this.repo.findOneByOrFail({ userId });
        return this.toRecord(row);
    }

    async findByUserId(userId: string): Promise<UserAppClientStateRecord | null> {
        const row = await this.repo.findOne({ where: { userId: userId.trim() } });
        return row ? this.toRecord(row) : null;
    }

    async getConsolidatedStats(): Promise<AppClientConsolidatedStats> {
        // Usa SQL direto para evitar problema do TypeORM 0.3.x:
        // `find()` com `select` parcial pode não hidratar PrimaryColumn (@OneToOne + @JoinColumn)
        // corretamente quando user_id é FK ao mesmo tempo que PK.
        const rawRows: RawAppClientRow[] = await AppDataSource.query(`
            SELECT
                user_id     AS userId,
                platform    AS platform,
                app_version AS appVersion,
                os_version  AS osVersion
            FROM user_app_client_state
        `);

        const dedupedRows = dedupeRawAppClientRows(rawRows);
        return buildAppClientConsolidatedStats(dedupedRows);
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

// Linha bruta devolvida pelo MySQL (aliases podem vir em snake_case dependendo do driver)
type RawAppClientRow = {
    userId?: unknown;
    user_id?: unknown;
    platform?: unknown;
    appVersion?: unknown;
    app_version?: unknown;
    osVersion?: unknown;
    os_version?: unknown;
};

type AppClientConsolidatedRow = {
    userId: string;
    platform: string;
    appVersion: string;
    osVersion: string;
};

function normalizeRawRow(row: RawAppClientRow): AppClientConsolidatedRow {
    return {
        userId:     String(row.userId     ?? row.user_id    ?? '').trim(),
        platform:   String(row.platform   ?? '').trim().toUpperCase(),
        appVersion: String(row.appVersion ?? row.app_version ?? '').trim(),
        osVersion:  String(row.osVersion  ?? row.os_version  ?? '').trim()
    };
}

function dedupeRawAppClientRows(rawRows: RawAppClientRow[]): AppClientConsolidatedRow[] {
    const seen = new Map<string, AppClientConsolidatedRow>();
    for (const raw of rawRows) {
        const row = normalizeRawRow(raw);
        if (row.userId) {
            seen.set(row.userId, row);
        }
    }
    return [...seen.values()];
}

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

        if (row.appVersion) {
            versionMap.set(row.appVersion, (versionMap.get(row.appVersion) ?? 0) + 1);
        }

        if (!row.osVersion) continue;

        if (row.platform === 'ANDROID') {
            osByPlatform.ANDROID.set(row.osVersion, (osByPlatform.ANDROID.get(row.osVersion) ?? 0) + 1);
        } else if (row.platform === 'IOS') {
            osByPlatform.IOS.set(row.osVersion, (osByPlatform.IOS.get(row.osVersion) ?? 0) + 1);
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
