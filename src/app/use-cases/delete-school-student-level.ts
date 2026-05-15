import type { EnrollmentProgressRepository } from '../../ports/repositories/enrollment-progress.repo';
import { AppError, ErrorCode } from '../../shared/errors';

export class DeleteSchoolStudentLevel {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: { schoolId: string; levelId: string }): Promise<void> {
        const schoolId = input.schoolId.trim();
        const levelId = input.levelId.trim();

        const existing = await this.progress.findLevel(schoolId, levelId);
        if (!existing) {
            throw AppError.fromCode(ErrorCode.SCHOOL_STUDENT_LEVEL_NOT_FOUND, { levelId });
        }

        const usage = await this.progress.countLevelAssociations(schoolId, levelId);
        if (usage > 0) {
            throw AppError.fromCode(ErrorCode.SCHOOL_STUDENT_LEVEL_IN_USE, {
                levelId,
                associatedCount: usage
            });
        }

        await this.progress.deleteLevel(schoolId, levelId);
    }
}
