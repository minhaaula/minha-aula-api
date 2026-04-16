import { describe, expect, it, vi } from 'vitest';
import { SendClassPushNotification } from '../../src/app/use-cases/send-class-push-notification';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';
import { Enrollment } from '../../src/domain/entities/enrollment';
import { School } from '../../src/domain/entities/school';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import type { CourseRepository } from '../../src/ports/repositories/course.repo';
import type { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import type { EnrollmentRepository } from '../../src/ports/repositories/enrollment.repo';
import type { NotificationRepository } from '../../src/ports/repositories/notification.repo';
import type { OutboxRepository } from '../../src/ports/repositories/outbox.repo';
import type { SchoolRepository } from '../../src/ports/repositories/school.repo';

describe('SendClassPushNotification (preferences)', () => {
    it('não enfileira push quando a escola desabilita push', async () => {
        const schoolId = '550e8400-e29b-41d4-a716-446655440000';
        const courseId = '660e8400-e29b-41d4-a716-446655440000';
        const classId = '770e8400-e29b-41d4-a716-446655440000';

        const course = Course.create({ id: courseId, schoolId, name: 'Curso', description: null });
        const courseClass = CourseClass.create({
            id: classId,
            courseId,
            label: 'Turma A',
            schedule: [{ day: 'SEG', start: '10:00', end: '11:00' }]
        });
        const enrollment = Enrollment.createForUser({
            id: 'enr-1',
            courseClassId: classId,
            ownerUserId: 'user-1',
            studentUserId: 'user-1'
        });
        const school = School.create({
            id: schoolId,
            name: 'Escola',
            email: 'escola@teste.com',
            phone: '11999999999',
            cnpj: '11222333000199',
            addresses: [
                PostalAddress.create({
                    street: 'Rua A',
                    number: '1',
                    city: 'SP',
                    state: 'SP',
                    zipCode: '01001000',
                    complement: null,
                    district: null
                })
            ],
            notificationsPushEnabled: false
        });

        const courses: CourseRepository = {
            findById: vi.fn(async (id: string) => (id === courseId ? course : null)),
            findBySchoolId: vi.fn(async () => []),
            save: vi.fn(async () => undefined)
        } as any;

        const classes: CourseClassRepository = {
            findById: vi.fn(async (id: string) => (id === classId ? courseClass : null)),
            save: vi.fn(async () => undefined),
            findByCourseId: vi.fn(async () => []),
            findByCourseIds: vi.fn(async () => [])
        } as any;

        const enrollments: EnrollmentRepository = {
            findById: vi.fn(async () => null),
            findByClassAndUser: vi.fn(async () => null),
            findByClassAndDependent: vi.fn(async () => null),
            findActiveByClassIds: vi.fn(async () => [enrollment]),
            findActiveByDependentId: vi.fn(async () => []),
            save: vi.fn(async () => undefined)
        };

        const notifications: NotificationRepository = {
            save: vi.fn(async () => undefined)
        } as any;

        const outbox: OutboxRepository = {
            enqueue: vi.fn(async () => undefined)
        };

        const schools: SchoolRepository = {
            findById: vi.fn(async (id: string) => (id === schoolId ? school : null)),
            findAll: vi.fn(async () => []),
            save: vi.fn(async () => undefined)
        };

        const uc = new SendClassPushNotification(courses, classes, enrollments, notifications, outbox, schools);
        const result = await uc.exec({ schoolId, classId, title: 't', message: 'm', metadata: null });

        expect(result.recipients).toBe(0);
        expect((outbox.enqueue as any).mock.calls.length).toBe(0);
        expect((notifications.save as any).mock.calls.length).toBe(1);
    });
});

