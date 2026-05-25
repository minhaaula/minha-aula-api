import { NotificationRepository, NotificationListItem } from '../../../ports/repositories/notification.repo';

export class ListStudentNotifications {
    constructor(private readonly notifications: NotificationRepository) {}

    async exec(input: {
        userId: string;
        limit?: number;
        offset?: number;
    }): Promise<{ notifications: NotificationListItem[] }> {
        const userId = input.userId?.trim();
        if (!userId) {
            return { notifications: [] };
        }

        if (!this.notifications.findByUserId) {
            return { notifications: [] };
        }

        const notifications = await this.notifications.findByUserId({
            userId,
            limit: input.limit,
            offset: input.offset
        });

        return { notifications };
    }
}

