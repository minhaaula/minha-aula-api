export type NotificationScope = 'USER' | 'SCHOOL' | 'CLASS';

export class Notification {
    private constructor(
        public readonly id: string,
        public readonly scope: NotificationScope,
        public readonly schoolId: string | null,
        public readonly userId: string | null,
        public readonly courseClassId: string | null,
        public readonly title: string,
        public readonly message: string,
        public readonly metadata: Record<string, unknown> | null,
        public readonly sentAt: Date,
        public readAt: Date | null
    ) {}

    static create(params: {
        id: string;
        scope: NotificationScope;
        schoolId?: string | null;
        userId?: string | null;
        courseClassId?: string | null;
        title: string;
        message: string;
        metadata?: Record<string, unknown> | null;
        sentAt?: Date;
        readAt?: Date | null;
    }) {
        const title = params.title.trim();
        const message = params.message.trim();
        if (!title) throw new Error('Notification title is required');
        if (!message) throw new Error('Notification message is required');

        const schoolId = params.schoolId?.trim() || null;
        const userId = params.userId?.trim() || null;
        const courseClassId = params.courseClassId?.trim() || null;

        if (params.scope === 'USER' && !userId) throw new Error('User notification requires user id');
        if (params.scope === 'SCHOOL' && !schoolId) throw new Error('School notification requires school id');
        if (params.scope === 'CLASS' && !courseClassId) throw new Error('Class notification requires course class id');

        return new Notification(
            params.id,
            params.scope,
            schoolId,
            userId,
            courseClassId,
            title,
            message,
            params.metadata ?? null,
            params.sentAt ?? new Date(),
            params.readAt ?? null
        );
    }

    markRead(date: Date = new Date()) {
        this.readAt = date;
    }
}
