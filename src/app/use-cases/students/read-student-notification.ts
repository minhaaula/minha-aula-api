import { NotificationRepository } from '../../../ports/repositories/notification.repo';
import { AppError } from '../../../shared/errors';
import { equalUuid } from '../../../shared/normalize-uuid';

export class ReadStudentNotification {
    constructor(private readonly notifications: NotificationRepository) {}

    async exec(input: {
        userId: string;
        notificationId: string;
    }): Promise<{ id: string; readAt: string }> {
        const userId = input.userId?.trim();
        const notificationId = input.notificationId?.trim();
        if (!userId || !notificationId) {
            throw AppError.notFound('Notificação', { notificationId });
        }

        const notification = await this.notifications.findById(notificationId);
        if (!notification?.userId || !equalUuid(notification.userId, userId)) {
            throw AppError.notFound('Notificação', { notificationId });
        }

        if (notification.readAt) {
            return {
                id: notification.id,
                readAt: notification.readAt.toISOString()
            };
        }

        notification.markRead();
        await this.notifications.save(notification);

        return {
            id: notification.id,
            readAt: notification.readAt!.toISOString()
        };
    }
}
