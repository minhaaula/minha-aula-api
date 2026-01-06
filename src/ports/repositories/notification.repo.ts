import { Notification } from '../../domain/entities/notification';

export interface NotificationListItem {
    id: string;
    scope: 'USER' | 'SCHOOL' | 'CLASS';
    schoolId: string | null;
    userId: string | null;
    courseClassId: string | null;
    title: string;
    message: string;
    metadata: Record<string, unknown> | null;
    sentAt: Date;
    readAt: Date | null;
}

export interface NotificationRepository {
    findById(id: string): Promise<Notification | null>;
    save(notification: Notification): Promise<void>;
    findBySchoolId?(params: {
        schoolId: string;
        limit?: number;
        offset?: number;
    }): Promise<NotificationListItem[]>;
    findByUserId?(params: {
        userId: string;
        limit?: number;
        offset?: number;
    }): Promise<NotificationListItem[]>;
}
