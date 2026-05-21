import type { EnrollmentProgressRepository } from '../../../ports/repositories/enrollment-progress.repo';

export class ListEnrollmentLevelPromotions {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: { schoolId: string; enrollmentId: string; order?: 'asc' | 'desc' }) {
        const schoolId = input.schoolId.trim();
        const enrollmentId = input.enrollmentId.trim();
        const order = input.order === 'desc' ? 'desc' : 'asc';

        const ctx = await this.progress.findEnrollmentTimelineContextInSchool(enrollmentId, schoolId);
        if (!ctx) return null;

        const promotions = await this.progress.listPromotions(enrollmentId, order);
        const certificates = await this.progress.listCertificatesByEnrollment(enrollmentId);
        const certByPromotion = new Map(certificates.map((c) => [c.promotionId, c]));

        return {
            enrollmentId,
            promotions: promotions.map((p) => {
                const cert = certByPromotion.get(p.id);
                return {
                    id: p.id,
                    fromLevelId: p.fromLevelId,
                    toLevelId: p.toLevelId,
                    fromLevelLabelSnapshot: p.fromLevelLabelSnapshot,
                    toLevelLabelSnapshot: p.toLevelLabelSnapshot,
                    fromLevelSortOrderSnapshot: p.fromLevelSortOrderSnapshot,
                    toLevelSortOrderSnapshot: p.toLevelSortOrderSnapshot,
                    promotedAt: p.promotedAt.toISOString(),
                    notes: p.notes,
                    createdByUserId: p.createdByUserId,
                    createdAt: p.createdAt.toISOString(),
                    certificate: cert
                        ? {
                              id: cert.id,
                              status: cert.status,
                              certificateTemplateId: cert.certificateTemplateId,
                              logicalTemplateId: cert.logicalTemplateId ?? null,
                              templateName: cert.templateName ?? null,
                              documentUrl: cert.documentUrl,
                              issuedAt: cert.issuedAt.toISOString()
                          }
                        : null
                };
            })
        };
    }
}
