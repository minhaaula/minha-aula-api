import type { EnrollmentProgressRepository } from '../../ports/repositories/enrollment-progress.repo';

export class ListSchoolStudentLevels {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: { schoolId: string }) {
        const schoolId = input.schoolId.trim();
        const levels = await this.progress.listLevels(schoolId);
        return levels.map((l) => ({
            id: l.id,
            label: l.label,
            templateCode: l.templateCode,
            sortOrder: l.sortOrder,
            createdAt: l.createdAt.toISOString(),
            updatedAt: l.updatedAt.toISOString()
        }));
    }
}
