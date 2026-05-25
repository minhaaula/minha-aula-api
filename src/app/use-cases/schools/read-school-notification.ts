import type { NotificationRepository } from '../../../ports/repositories/notification.repo';
import { AppError } from '../../../shared/errors';
import { equalUuid } from '../../../shared/normalize-uuid';

export class ReadSchoolNotification {
    constructor(private readonly notifications: NotificationRepository) {}

    async exec(input: {
        schoolId: string;
        notificationId: string;
    }): Promise<{ id: string; readAt: string }> {
        const schoolId = input.schoolId?.trim();
        const notificationId = input.notificationId?.trim();
        if (!schoolId || !notificationId) {
            throw AppError.notFound('Notificação', { notificationId });
        }

        const notification = await this.notifications.findById(notificationId);
        if (!notification?.schoolId || !equalUuid(notification.schoolId, schoolId)) {
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

