import { NotificationRepository } from '../../ports/repositories/notification.repo';
import { OutboxRepository } from '../../ports/repositories/outbox.repo';
import { Notification } from '../../domain/entities/notification';
import { Uuid } from '../../shared/uuid';

export type StudentInAppNotificationKind =
    | 'WELCOME'
    | 'ENROLLMENT_REQUEST_RECEIVED'
    | 'ENROLLMENT_CONFIRMED'
    | 'ENROLLMENT_REQUEST_REJECTED'
    | 'TUITION_DUE_REMINDER';

/**
 * Persiste notificação in-app (sino) para o aluno e, opcionalmente, enfileira push FCM.
 */
export class NotifyStudentUser {
    constructor(
        private readonly notifications: NotificationRepository,
        private readonly outbox: OutboxRepository
    ) {}

    async exec(input: {
        userId: string;
        schoolId?: string | null;
        title: string;
        message: string;
        kind: StudentInAppNotificationKind;
        sendPush: boolean;
        extraMetadata?: Record<string, unknown> | null;
    }): Promise<{ notificationId: string }> {
        const userId = input.userId.trim();
        const schoolId = input.schoolId?.trim() || null;
        const metadata: Record<string, unknown> = {
            kind: input.kind,
            ...(input.extraMetadata && typeof input.extraMetadata === 'object' ? input.extraMetadata : {})
        };

        const notification = Notification.create({
            id: Uuid(),
            scope: 'USER',
            userId,
            schoolId,
            title: input.title,
            message: input.message,
            metadata
        });

        await this.notifications.save(notification);

        if (input.sendPush) {
            const data: Record<string, string> = {
                notificationId: notification.id,
                scope: 'USER',
                userId,
                schoolId: schoolId ?? ''
            };
            await this.outbox.enqueue({
                type: 'push_notification',
                aggregateId: notification.id,
                payload: {
                    userIds: [userId],
                    title: input.title,
                    body: input.message,
                    data
                }
            });
        }

        return { notificationId: notification.id };
    }
}
