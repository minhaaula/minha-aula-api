import type { NotificationRepository } from '../../../ports/repositories/notification.repo';

export class ReadAllSchoolNotifications {
    constructor(private readonly notifications: NotificationRepository) {}

    async exec(input: { schoolId: string }): Promise<{ markedCount: number }> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            return { markedCount: 0 };
        }

        if (!this.notifications.markAllAsReadBySchoolId) {
            return { markedCount: 0 };
        }

        const markedCount = await this.notifications.markAllAsReadBySchoolId(schoolId);
        return { markedCount };
    }
}
