import { describe, expect, it, vi } from 'vitest';
import { RecordEnrollmentLevelPromotion } from '../../src/app/use-cases/record-enrollment-level-promotion';
import { DeleteSchoolStudentLevel } from '../../src/app/use-cases/delete-school-student-level';
import { Enrollment } from '../../src/domain/entities/enrollment';
import type { EnrollmentProgressRepository } from '../../src/ports/repositories/enrollment-progress.repo';
import type { EnrollmentRepository } from '../../src/ports/repositories/enrollment.repo';
import { EnrollmentPromotionCertificateStatus } from '../../src/domain/value-objects/enrollment-promotion-certificate-status';
import { ErrorCode } from '../../src/shared/errors';

function activeEnrollment() {
    return Enrollment.createForUser({
        id: 'enr-1',
        courseClassId: 'class-1',
        ownerUserId: 'owner-1',
        studentUserId: 'student-1',
        status: 'ACTIVE'
    });
}

describe('Enrollment level promotion and levels', () => {
    it('rejects promotion for inactive enrollment', async () => {
        const progress = {
            findEnrollmentTimelineContextInSchool: vi.fn(async () => ({
                id: 'enr-1',
                schoolId: 'school-1',
                status: 'CANCELLED' as const,
                enrolledAt: new Date(),
                updatedAt: new Date(),
                ownerUserId: 'owner-1'
            }))
        } as unknown as EnrollmentProgressRepository;

        const uc = new RecordEnrollmentLevelPromotion(progress, {} as EnrollmentRepository);
        await expect(
            uc.exec({
                schoolId: 'school-1',
                enrollmentId: 'enr-1',
                toLevelId: 'level-2'
            })
        ).rejects.toMatchObject({ code: ErrorCode.ENROLLMENT_NOT_ACTIVE_FOR_PROMOTION });
    });

    it('creates pending certificate and timeline event on promotion', async () => {
        const enrollment = activeEnrollment();
        const createPromotion = vi.fn();
        const createTimelineEvent = vi.fn();
        const createPromotionCertificate = vi.fn();

        const progress = {
            findEnrollmentTimelineContextInSchool: vi.fn(async () => ({
                id: 'enr-1',
                schoolId: 'school-1',
                status: 'ACTIVE' as const,
                enrolledAt: new Date(),
                updatedAt: new Date(),
                ownerUserId: 'owner-1'
            })),
            findLevel: vi.fn(async () => ({
                id: 'level-2',
                schoolId: 'school-1',
                label: 'Faixa Azul',
                templateCode: null,
                sortOrder: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            })),
            findCertificateTemplate: vi.fn(async () => ({
                id: 'tpl-1',
                schoolId: 'school-1',
                name: 'Cert',
                logicalTemplateId: 'cert_v1',
                layoutConfig: null,
                createdAt: new Date(),
                updatedAt: new Date()
            })),
            createPromotion,
            createTimelineEvent,
            createPromotionCertificate
        } as unknown as EnrollmentProgressRepository;

        const enrollments: EnrollmentRepository = {
            findById: vi.fn(async () => enrollment),
            findByClassAndUser: async () => null,
            findByClassAndDependent: async () => null,
            findActiveByClassIds: async () => [],
            findActiveByDependentId: async () => [],
            save: vi.fn()
        };

        const uc = new RecordEnrollmentLevelPromotion(progress, enrollments);
        const result = await uc.exec({
            schoolId: 'school-1',
            enrollmentId: 'enr-1',
            toLevelId: 'level-2',
            issueCertificate: true,
            certificateTemplateId: 'tpl-1',
            actorUserId: 'user-school'
        });

        expect(createPromotion).toHaveBeenCalled();
        expect(createTimelineEvent).toHaveBeenCalled();
        expect(createPromotionCertificate).toHaveBeenCalledWith(
            expect.objectContaining({
                status: EnrollmentPromotionCertificateStatus.PENDING,
                documentUrl: null
            })
        );
        expect(result.certificate?.status).toBe('PENDING');
        expect(enrollment.currentSchoolStudentLevelId).toBe('level-2');
    });

    it('blocks level delete when students are associated', async () => {
        const progress = {
            findLevel: vi.fn(async () => ({
                id: 'level-1',
                schoolId: 'school-1',
                label: 'X',
                templateCode: null,
                sortOrder: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            })),
            countLevelAssociations: vi.fn(async () => 3),
            deleteLevel: vi.fn()
        } as unknown as EnrollmentProgressRepository;

        const uc = new DeleteSchoolStudentLevel(progress);
        await expect(uc.exec({ schoolId: 'school-1', levelId: 'level-1' })).rejects.toMatchObject({
            code: ErrorCode.SCHOOL_STUDENT_LEVEL_IN_USE
        });
        expect(progress.deleteLevel).not.toHaveBeenCalled();
    });
});
