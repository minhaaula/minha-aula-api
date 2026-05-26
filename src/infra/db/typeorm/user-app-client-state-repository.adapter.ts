import { AppDataSource } from './datasource';
import {
    type AppClientConsolidatedStats,
    type AppClientPlatform,
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
        const totalUsers = await this.repo.count();

        const versionRows = await this.repo
            .createQueryBuilder('state')
            .select('state.app_version', 'appVersion')
            .addSelect('COUNT(*)', 'count')
            .groupBy('state.app_version')
            .orderBy('count', 'DESC')
            .addOrderBy('state.app_version', 'ASC')
            .getRawMany<{ appVersion: string; count: string }>();

        const platformRows = await this.repo
            .createQueryBuilder('state')
            .select('state.platform', 'platform')
            .addSelect('COUNT(*)', 'count')
            .groupBy('state.platform')
            .getRawMany<{ platform: string; count: string }>();

        const osRows = await this.repo
            .createQueryBuilder('state')
            .select('state.platform', 'platform')
            .addSelect('state.os_version', 'osVersion')
            .addSelect('COUNT(*)', 'count')
            .groupBy('state.platform')
            .addGroupBy('state.os_version')
            .orderBy('count', 'DESC')
            .addOrderBy('state.os_version', 'ASC')
            .getRawMany<{ platform: string; osVersion: string; count: string }>();

        const byPlatform = { ANDROID: 0, IOS: 0 };
        for (const row of platformRows) {
            const count = Number(row.count ?? 0);
            if (row.platform === 'ANDROID') {
                byPlatform.ANDROID = count;
            } else if (row.platform === 'IOS') {
                byPlatform.IOS = count;
            }
        }

        const osVersionsByPlatform: AppClientConsolidatedStats['osVersionsByPlatform'] = {
            ANDROID: [],
            IOS: []
        };
        for (const row of osRows) {
            const item = {
                osVersion: String(row.osVersion ?? ''),
                count: Number(row.count ?? 0)
            };
            if (row.platform === 'ANDROID') {
                osVersionsByPlatform.ANDROID.push(item);
            } else if (row.platform === 'IOS') {
                osVersionsByPlatform.IOS.push(item);
            }
        }

        return {
            totalUsers,
            appVersions: versionRows.map((row) => ({
                appVersion: String(row.appVersion ?? ''),
                count: Number(row.count ?? 0)
            })),
            byPlatform,
            osVersionsByPlatform
        };
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
