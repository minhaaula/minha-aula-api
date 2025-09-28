import { Notification } from '../../domain/entities/notification';

export interface NotificationRepository {
    findById(id: string): Promise<Notification | null>;
    save(notification: Notification): Promise<void>;
}
