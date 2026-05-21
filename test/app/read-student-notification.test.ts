import { describe, expect, it } from 'vitest';
import { ReadStudentNotification } from '../../src/app/use-cases/students/read-student-notification';
import { NotificationRepository } from '../../src/ports/repositories/notification.repo';
import { Notification } from '../../src/domain/entities/notification';
import { AppError } from '../../src/shared/errors';

class InMemoryNotificationRepository implements NotificationRepository {
    private readonly items = new Map<string, Notification>();

    async findById(id: string): Promise<Notification | null> {
        return this.items.get(id) ?? null;
    }

    async save(notification: Notification): Promise<void> {
        this.items.set(notification.id, notification);
    }

    seed(notification: Notification) {
        this.items.set(notification.id, notification);
    }
}

describe('ReadStudentNotification', () => {
    const userId = '789e4567-e89b-12d3-a456-426614174000';
    const notifId = '550e8400-e29b-41d4-a716-446655440000';

    it('marca como lida e persiste', async () => {
        const repo = new InMemoryNotificationRepository();
        repo.seed(
            Notification.create({
                id: notifId,
                scope: 'USER',
                userId,
                title: 'Teste',
                message: 'Mensagem',
                readAt: null
            })
        );
        const uc = new ReadStudentNotification(repo);
        const out = await uc.exec({ userId, notificationId: notifId });
        expect(out.id).toBe(notifId);
        expect(out.readAt).toBeDefined();
        const row = await repo.findById(notifId);
        expect(row?.readAt).not.toBeNull();
    });

    it('é idempotente se já lida', async () => {
        const repo = new InMemoryNotificationRepository();
        const readAt = new Date('2024-01-01T12:00:00.000Z');
        repo.seed(
            Notification.create({
                id: notifId,
                scope: 'USER',
                userId,
                title: 'Teste',
                message: 'Mensagem',
                readAt
            })
        );
        const uc = new ReadStudentNotification(repo);
        const out = await uc.exec({ userId, notificationId: notifId });
        expect(out.readAt).toBe(readAt.toISOString());
    });

    it('lança NOT_FOUND se notificação não existe', async () => {
        const repo = new InMemoryNotificationRepository();
        const uc = new ReadStudentNotification(repo);
        await expect(uc.exec({ userId, notificationId: notifId })).rejects.toSatisfy(
            (e: unknown) => e instanceof AppError && e.code === 'NOT_FOUND'
        );
    });

    it('lança NOT_FOUND se notificação é de outro usuário', async () => {
        const repo = new InMemoryNotificationRepository();
        repo.seed(
            Notification.create({
                id: notifId,
                scope: 'USER',
                userId: '00000000-0000-4000-8000-000000000001',
                title: 'Teste',
                message: 'Mensagem',
                readAt: null
            })
        );
        const uc = new ReadStudentNotification(repo);
        await expect(uc.exec({ userId, notificationId: notifId })).rejects.toSatisfy(
            (e: unknown) => e instanceof AppError && e.code === 'NOT_FOUND'
        );
    });

    it('lança NOT_FOUND para notificação sem userId (ex.: CLASS)', async () => {
        const repo = new InMemoryNotificationRepository();
        repo.seed(
            Notification.create({
                id: notifId,
                scope: 'CLASS',
                schoolId: 'a585a342-650a-4ab7-a606-07ae09bb72e1',
                courseClassId: '456e4567-e89b-12d3-a456-426614174002',
                title: 'Turma',
                message: 'Aviso',
                readAt: null
            })
        );
        const uc = new ReadStudentNotification(repo);
        await expect(uc.exec({ userId, notificationId: notifId })).rejects.toSatisfy(
            (e: unknown) => e instanceof AppError && e.code === 'NOT_FOUND'
        );
    });
});
