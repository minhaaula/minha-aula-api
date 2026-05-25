import type { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import type { EnrollmentProgressRepository } from '../../../ports/repositories/enrollment-progress.repo';
import { EnrollmentTimelineEventKind } from '../../../domain/value-objects/enrollment-timeline-event-kind';
import { EnrollmentPromotionCertificateStatus } from '../../../domain/value-objects/enrollment-promotion-certificate-status';
import { AppError, ErrorCode } from '../../../shared/errors';
import { Uuid } from '../../../shared/uuid';

export class RecordEnrollmentLevelPromotion {
    constructor(
        private readonly progress: EnrollmentProgressRepository,
        private readonly enrollments: EnrollmentRepository
    ) {}

    async exec(input: {
        schoolId: string;
        enrollmentId: string;
        toLevelId: string;
        fromLevelId?: string | null;
        notes?: string | null;
        actorUserId?: string | null;
        issueCertificate?: boolean;
        certificateTemplateId?: string | null;
    }) {
        const schoolId = input.schoolId.trim();
        const enrollmentId = input.enrollmentId.trim();
        const toLevelId = input.toLevelId.trim();

        const ctx = await this.progress.findEnrollmentTimelineContextInSchool(enrollmentId, schoolId);
        if (!ctx) throw AppError.notFound('Matrícula', { enrollmentId });

        if (ctx.status !== 'ACTIVE') {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_NOT_ACTIVE_FOR_PROMOTION, {
                enrollmentId,
                status: ctx.status
            });
        }

        const toLevel = await this.progress.findLevel(schoolId, toLevelId);
        if (!toLevel) throw AppError.fromCode(ErrorCode.SCHOOL_STUDENT_LEVEL_NOT_FOUND, { levelId: toLevelId });

        const enrollment = await this.enrollments.findById(enrollmentId);
        if (!enrollment) throw AppError.notFound('Matrícula', { enrollmentId });

        const issueCertificate = Boolean(input.issueCertificate);
        if (issueCertificate) {
            const templateId = input.certificateTemplateId?.trim();
            if (!templateId) {
                throw AppError.validation('certificateTemplateId é obrigatório quando issueCertificate é true');
            }
            const template = await this.progress.findCertificateTemplate(schoolId, templateId);
            if (!template) throw AppError.notFound('Template de certificado', { certificateTemplateId: templateId });
        }

        let fromFk: string | null = null;
        let fromSnapLabel: string | null = null;
        let fromSnapOrder: number | null = null;

        const explicitFrom = input.fromLevelId !== undefined && input.fromLevelId !== null && String(input.fromLevelId).trim();
        if (explicitFrom) {
            const fid = String(input.fromLevelId).trim();
            const fromRow = await this.progress.findLevel(schoolId, fid);
            if (!fromRow) throw AppError.fromCode(ErrorCode.SCHOOL_STUDENT_LEVEL_NOT_FOUND, { levelId: fid });
            fromFk = fromRow.id;
            fromSnapLabel = fromRow.label;
            fromSnapOrder = fromRow.sortOrder;
        } else if (enrollment.currentSchoolStudentLevelId) {
            const fromRow = await this.progress.findLevel(schoolId, enrollment.currentSchoolStudentLevelId);
            if (fromRow) {
                fromFk = fromRow.id;
                fromSnapLabel = fromRow.label;
                fromSnapOrder = fromRow.sortOrder;
            }
        }

        const promotedAt = new Date();
        const promotionId = Uuid();
        const actorUserId = input.actorUserId?.trim() || null;

        await this.progress.createPromotion({
            id: promotionId,
            enrollmentId,
            fromLevelId: fromFk,
            toLevelId: toLevel.id,
            fromLevelLabelSnapshot: fromSnapLabel,
            toLevelLabelSnapshot: toLevel.label,
            fromLevelSortOrderSnapshot: fromSnapOrder,
            toLevelSortOrderSnapshot: toLevel.sortOrder,
            promotedAt,
            notes: input.notes?.trim() || null,
            createdByUserId: actorUserId
        });

        await this.progress.createTimelineEvent({
            id: Uuid(),
            enrollmentId,
            eventType: EnrollmentTimelineEventKind.LEVEL_PROMOTION,
            payload: {
                promotionId,
                fromLevelId: fromFk,
                toLevelId: toLevel.id,
                fromLevelLabel: fromSnapLabel,
                toLevelLabel: toLevel.label,
                notes: input.notes?.trim() || null
            },
            occurredAt: promotedAt,
            actorUserId
        });

        let certificate: {
            id: string;
            status: string;
            certificateTemplateId: string;
        } | null = null;

        if (issueCertificate && input.certificateTemplateId) {
            const certificateId = Uuid();
            await this.progress.createPromotionCertificate({
                id: certificateId,
                enrollmentId,
                promotionId,
                certificateTemplateId: input.certificateTemplateId.trim(),
                status: EnrollmentPromotionCertificateStatus.PENDING,
                issuedAt: promotedAt,
                documentUrl: null,
                metadata: null
            });
            certificate = {
                id: certificateId,
                status: EnrollmentPromotionCertificateStatus.PENDING,
                certificateTemplateId: input.certificateTemplateId.trim()
            };
        }

        enrollment.applyCurrentSchoolStudentLevel(toLevel.id);
        await this.enrollments.save(enrollment);

        return {
            promotionId,
            enrollmentId,
            promotedAt: promotedAt.toISOString(),
            currentSchoolStudentLevelId: toLevel.id,
            currentLevel: {
                id: toLevel.id,
                label: toLevel.label,
                sortOrder: toLevel.sortOrder,
                templateCode: toLevel.templateCode
            },
            certificate
        };
    }
}
