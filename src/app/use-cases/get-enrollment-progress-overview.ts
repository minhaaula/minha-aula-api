import type { EnrollmentProgressRepository } from '../../ports/repositories/enrollment-progress.repo';

export class GetEnrollmentProgressOverview {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: { schoolId: string; enrollmentId: string; timelineLimit?: number }) {
        const schoolId = input.schoolId.trim();
        const enrollmentId = input.enrollmentId.trim();
        const limit = input.timelineLimit ?? 50;

        const enrollment = await this.progress.findEnrollmentSummaryInSchool(enrollmentId, schoolId);
        if (!enrollment) {
            return null;
        }

        const promotions = await this.progress.listPromotions(enrollmentId);
        const timeline = await this.progress.listTimelineEvents(enrollmentId, limit);

        let currentLevelDetail: {
            id: string;
            label: string;
            sortOrder: number;
            templateCode: string | null;
        } | null = null;
        if (enrollment.currentSchoolStudentLevelId) {
            const level = await this.progress.findLevel(schoolId, enrollment.currentSchoolStudentLevelId);
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
            enrollmentId: enrollment.id,
            currentSchoolStudentLevelId: enrollment.currentSchoolStudentLevelId,
            currentLevel: currentLevelDetail,
            promotions: promotions.map((p) => ({
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
                createdAt: p.createdAt.toISOString()
            })),
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
