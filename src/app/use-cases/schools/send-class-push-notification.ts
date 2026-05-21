import { CourseRepository } from '../../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../../ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { NotificationRepository } from '../../../ports/repositories/notification.repo';
import { OutboxRepository } from '../../../ports/repositories/outbox.repo';
import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import { Notification } from '../../../domain/entities/notification';
import { Uuid } from '../../../shared/uuid';

export class SendClassPushNotification {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly notifications: NotificationRepository,
        private readonly outbox: OutboxRepository,
        private readonly schools: SchoolRepository
    ) {}

    async exec(input: { schoolId: string; classId: string; title: string; message: string; metadata?: Record<string, unknown> | null }) {
        const schoolId = input.schoolId.trim();
        const classId = input.classId.trim();
        const title = input.title.trim();
        const message = input.message.trim();
        if (!schoolId) throw new Error('schoolId is required');
        if (!classId) throw new Error('classId is required');
        if (!title) throw new Error('title is required');
        if (!message) throw new Error('message is required');

        const courseClass = await this.classes.findById(classId);
        if (!courseClass) throw new Error('Class not found');

        const course = await this.courses.findById(courseClass.courseId);
        if (!course || course.schoolId !== schoolId) {
            throw new Error('Class not found for this school');
        }

        const activeEnrollments = await this.enrollments.findActiveByClassIds([classId]);
        const userIds = Array.from(new Set(activeEnrollments.map((e) => e.ownerUserId).filter(Boolean)));

        const notification = Notification.create({
            id: Uuid(),
            scope: 'CLASS',
            schoolId,
            courseClassId: classId,
            title,
            message,
            metadata: input.metadata ?? null
        });

        await this.notifications.save(notification);

        const school = await this.schools.findById(schoolId);
        if (!school) throw new Error('School not found');
        if (!school.notificationsPushEnabled) {
            return { notificationId: notification.id, recipients: 0 };
        }

        // data do FCM precisa ser string:string
        const data: Record<string, string> = {
            notificationId: notification.id,
            scope: 'CLASS',
            schoolId,
            classId
        };

        await this.outbox.enqueue({
            type: 'push_notification',
            aggregateId: notification.id,
            payload: {
                userIds,
                title,
                body: message,
                data
            }
        });

        return { notificationId: notification.id, recipients: userIds.length };
    }
}

