import type { EnrollmentProgressRepository } from '../../ports/repositories/enrollment-progress.repo';
import { AppError } from '../../shared/errors';
import { QueryFailedError } from 'typeorm';
import { Uuid } from '../../shared/uuid';

export class IssueEnrollmentPromotionCertificate {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: {
        schoolId: string;
        enrollmentId: string;
        promotionId: string;
        certificateTemplateId: string;
        documentUrl?: string | null;
        metadata?: Record<string, unknown> | null;
    }) {
        const schoolId = input.schoolId.trim();
        const enrollmentId = input.enrollmentId.trim();
        const promotionId = input.promotionId.trim();
        const certificateTemplateId = input.certificateTemplateId.trim();

        const summary = await this.progress.findEnrollmentSummaryInSchool(enrollmentId, schoolId);
        if (!summary) throw AppError.notFound('Matrícula', { enrollmentId });

        const promotion = await this.progress.findPromotion(enrollmentId, promotionId);
        if (!promotion) throw AppError.notFound('Promoção', { promotionId });

        const template = await this.progress.findCertificateTemplate(schoolId, certificateTemplateId);
        if (!template) throw AppError.notFound('Template de certificado', { certificateTemplateId });

        const existing = await this.progress.countCertificatesByPromotionId(promotionId);
        if (existing > 0) {
            throw AppError.validation('Já existe certificado registrado para esta promoção.', { promotionId });
        }

        const id = Uuid();
        const issuedAt = new Date();

        try {
            await this.progress.createPromotionCertificate({
                id,
                enrollmentId,
                promotionId,
                certificateTemplateId: template.id,
                issuedAt,
                documentUrl: input.documentUrl?.trim().slice(0, 2048) || null,
                metadata: input.metadata ?? null
            });
        } catch (e: unknown) {
            if (e instanceof QueryFailedError && typeof (e as { driverError?: { errno?: number } }).driverError?.errno === 'number') {
                const errno = (e as { driverError: { errno: number } }).driverError.errno;
                if (errno === 1062) {
                    throw AppError.validation('Certificado já existente para esta promoção.', { promotionId });
                }
            }
            throw e;
        }

        return {
            id,
            enrollmentId,
            promotionId,
            certificateTemplateId: template.id,
            issuedAt: issuedAt.toISOString(),
            logicalTemplateId: template.logicalTemplateId
        };
    }
}
