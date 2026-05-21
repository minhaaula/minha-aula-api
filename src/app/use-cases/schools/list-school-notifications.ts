import { NotificationRepository, NotificationListItem } from '../../../ports/repositories/notification.repo';

export class ListSchoolNotifications {
    constructor(private readonly notifications: NotificationRepository) {}

    async exec(input: {
        schoolId: string;
        limit?: number;
        offset?: number;
    }): Promise<{ notifications: NotificationListItem[] }> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            return { notifications: [] };
        }

        if (!this.notifications.findBySchoolId) {
            return { notifications: [] };
        }

        const notifications = await this.notifications.findBySchoolId({
            schoolId,
            limit: input.limit,
            offset: input.offset
        });

        return { notifications };
    }
}

