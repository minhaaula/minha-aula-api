import type { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import type { EnrollmentProgressRepository } from '../../ports/repositories/enrollment-progress.repo';
import { AppError } from '../../shared/errors';
import { Uuid } from '../../shared/uuid';

export class RecordEnrollmentLevelPromotion {
    constructor(
        private readonly progress: EnrollmentProgressRepository,
        private readonly enrollments: EnrollmentRepository
    ) {}

    async exec(input: {
        schoolId: string;
        enrollmentId: string;
        toLevelId: string;
        /** Se omitido, usa o nível atual da matrícula como origem. */
        fromLevelId?: string | null;
        notes?: string | null;
        actorUserId?: string | null;
    }) {
        const schoolId = input.schoolId.trim();
        const enrollmentId = input.enrollmentId.trim();
        const toLevelId = input.toLevelId.trim();

        const summary = await this.progress.findEnrollmentSummaryInSchool(enrollmentId, schoolId);
        if (!summary) throw AppError.notFound('Matrícula', { enrollmentId });

        const toLevel = await this.progress.findLevel(schoolId, toLevelId);
        if (!toLevel) throw AppError.notFound('Nível escolar', { levelId: toLevelId });

        const enrollment = await this.enrollments.findById(enrollmentId);
        if (!enrollment) throw AppError.notFound('Matrícula', { enrollmentId });

        let fromFk: string | null = null;
        let fromSnapLabel: string | null = null;
        let fromSnapOrder: number | null = null;

        const explicitFrom = input.fromLevelId !== undefined && input.fromLevelId !== null && String(input.fromLevelId).trim();
        if (explicitFrom) {
            const fid = String(input.fromLevelId).trim();
            const fromRow = await this.progress.findLevel(schoolId, fid);
            if (!fromRow) throw AppError.notFound('Nível escolar', { levelId: fid });
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
            createdByUserId: input.actorUserId?.trim() || null
        });

        enrollment.applyCurrentSchoolStudentLevel(toLevel.id);
        await this.enrollments.save(enrollment);

        return {
            promotionId,
            enrollmentId,
            promotedAt: promotedAt.toISOString(),
            currentSchoolStudentLevelId: toLevel.id
        };
    }
}
