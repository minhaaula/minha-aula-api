import { AppDataSource } from './datasource';
import { NotificationRepository } from '../../../ports/repositories/notification.repo';
import { Notification } from '../../../domain/entities/notification';
import { NotificationOrm } from './entities/notification.orm';

export class NotificationRepositoryAdapter implements NotificationRepository {
    private readonly repo = AppDataSource.getRepository(NotificationOrm);

    async findById(id: string): Promise<Notification | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async save(notification: Notification): Promise<void> {
        await this.repo.save(this.toOrm(notification));
    }

    private toDomain(row: NotificationOrm): Notification {
        return Notification.create({
            id: row.id,
            scope: row.scope,
            schoolId: row.schoolId,
            userId: row.userId,
            courseClassId: row.courseClassId,
            title: row.title,
            message: row.message,
            metadata: row.metadata,
            sentAt: row.sentAt,
            readAt: row.readAt
        });
    }

    private toOrm(notification: Notification): NotificationOrm {
        const row = new NotificationOrm();
        row.id = notification.id;
        row.scope = notification.scope;
        row.schoolId = notification.schoolId;
        row.userId = notification.userId;
        row.courseClassId = notification.courseClassId;
        row.title = notification.title;
        row.message = notification.message;
        row.metadata = notification.metadata;
        row.sentAt = notification.sentAt;
        row.readAt = notification.readAt;
        return row;
    }
}


