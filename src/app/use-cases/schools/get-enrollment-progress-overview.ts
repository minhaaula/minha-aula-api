import type { EnrollmentProgressRepository } from '../../../ports/repositories/enrollment-progress.repo';

export class GetEnrollmentProgressOverview {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: { schoolId: string; enrollmentId: string; timelineLimit?: number }) {
        const schoolId = input.schoolId.trim();
        const enrollmentId = input.enrollmentId.trim();
        const limit = input.timelineLimit ?? 50;

        const ctx = await this.progress.findEnrollmentTimelineContextInSchool(enrollmentId, schoolId);
        if (!ctx) {
            return null;
        }

        const promotions = await this.progress.listPromotions(enrollmentId, 'asc');
        const certificates = await this.progress.listCertificatesByEnrollment(enrollmentId);
        const certByPromotion = new Map(certificates.map((c) => [c.promotionId, c]));
        const timeline = await this.progress.listTimelineEvents(enrollmentId, limit);

        let currentLevelDetail: {
            id: string;
            label: string;
            sortOrder: number;
            templateCode: string | null;
        } | null = null;

        const enrollmentSummary = await this.progress.findEnrollmentSummaryInSchool(enrollmentId, schoolId);
        const currentLevelId = enrollmentSummary?.currentSchoolStudentLevelId ?? null;

        if (currentLevelId) {
            const level = await this.progress.findLevel(schoolId, currentLevelId);
            if (level) {
                currentLevelDetail = {
                    id: level.id,
                    label: level.label,
                    sortOrder: level.sortOrder,
                    templateCode: level.templateCode
                };
            }
        }

        return {
            enrollmentId: ctx.id,
            enrollmentStatus: ctx.status,
            currentSchoolStudentLevelId: currentLevelId,
            currentLevel: currentLevelDetail,
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
                              documentUrl: cert.documentUrl,
                              issuedAt: cert.issuedAt.toISOString()
                          }
                        : null
                };
            }),
            timeline: timeline.map((t) => ({
                id: t.id,
                eventType: t.eventType,
                payload: t.payload,
                occurredAt: t.occurredAt.toISOString(),
                actorUserId: t.actorUserId,
                createdAt: t.createdAt.toISOString()
            }))
        };
    }
}
