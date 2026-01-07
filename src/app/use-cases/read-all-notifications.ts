import { NotificationRepository } from '../../ports/repositories/notification.repo';

export class ReadAllNotifications {
    constructor(private readonly notifications: NotificationRepository) {}

    async exec(input: {
        userId: string;
    }): Promise<{ markedCount: number }> {
        const userId = input.userId?.trim();
        if (!userId) {
            return { markedCount: 0 };
        }

        if (!this.notifications.markAllAsReadByUserId) {
            return { markedCount: 0 };
        }

        const markedCount = await this.notifications.markAllAsReadByUserId(userId);

        return { markedCount };
    }
}

