import type { UserRepository } from '../../../ports/repositories/user.repo';
import type {
    AppClientPlatform,
    UserAppClientStateRecord,
    UserAppClientStateRepository
} from '../../../ports/repositories/user-app-client-state.repo';
import { AppError, ErrorCode } from '../../../shared/errors';

export type UpsertStudentAppClientStateAppClient = {
    platform: AppClientPlatform;
    appVersion: string;
    osVersion: string;
    notificationsEnabled: boolean;
};

export type UpsertStudentAppClientStateInput = {
    userId: string;
    appClient: UpsertStudentAppClientStateAppClient;
};

export class UpsertStudentAppClientState {
    constructor(
        private readonly users: UserRepository,
        private readonly appClientState: UserAppClientStateRepository
    ) {}

    async exec(input: UpsertStudentAppClientStateInput): Promise<UserAppClientStateRecord> {
        const userId = input.userId.trim();
        if (!userId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'userId' });
        }

        const user = await this.users.findById(userId);
        if (!user) {
            throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId });
        }

        return this.appClientState.upsert({
            userId,
            platform: input.appClient.platform,
            appVersion: input.appClient.appVersion,
            osVersion: input.appClient.osVersion,
            notificationsEnabled: input.appClient.notificationsEnabled,
            lastSeenAt: new Date()
        });
    }
}
