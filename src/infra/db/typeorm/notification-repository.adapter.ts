import { AppDataSource } from './datasource';
import { NotificationRepository, NotificationListItem } from '../../../ports/repositories/notification.repo';
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

    async findBySchoolId(params: {
        schoolId: string;
        limit?: number;
        offset?: number;
    }): Promise<NotificationListItem[]> {
        const qb = this.repo
            .createQueryBuilder('notification')
            .where('notification.schoolId = :schoolId', { schoolId: params.schoolId })
            .orderBy('notification.sentAt', 'DESC');

        const limit = params.limit ?? 50;
        qb.take(Math.max(1, Math.min(limit, 100)));

        if (typeof params.offset === 'number' && params.offset > 0) {
            qb.skip(params.offset);
        }

        const rows = await qb.getMany();
        return rows.map(row => this.toListItem(row));
    }

    async findByUserId(params: {
        userId: string;
        limit?: number;
        offset?: number;
    }): Promise<NotificationListItem[]> {
        const qb = this.repo
            .createQueryBuilder('notification')
            .where('notification.userId = :userId', { userId: params.userId })
            .orderBy('notification.sentAt', 'DESC');

        const limit = params.limit ?? 50;
        qb.take(Math.max(1, Math.min(limit, 100)));

        if (typeof params.offset === 'number' && params.offset > 0) {
            qb.skip(params.offset);
        }

        const rows = await qb.getMany();
        return rows.map(row => this.toListItem(row));
    }

    async markAllAsReadByUserId(userId: string): Promise<number> {
        const readAt = new Date();
        const result = await this.repo
            .createQueryBuilder()
            .update(NotificationOrm)
            .set({ readAt })
            .where('userId = :userId', { userId })
            .andWhere('readAt IS NULL')
            .execute();

        return result.affected ?? 0;
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

    private toListItem(row: NotificationOrm): NotificationListItem {
        return {
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
        };
    }
}


