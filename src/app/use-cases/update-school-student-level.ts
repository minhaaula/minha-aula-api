import type { EnrollmentProgressRepository } from '../../ports/repositories/enrollment-progress.repo';
import { AppError, ErrorCode } from '../../shared/errors';
import { QueryFailedError } from 'typeorm';

export class UpdateSchoolStudentLevel {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: {
        schoolId: string;
        levelId: string;
        label: string;
        sortOrder: number;
        templateCode?: string | null;
    }) {
        const schoolId = input.schoolId.trim();
        const levelId = input.levelId.trim();
        const label = input.label.trim();
        if (!label) throw AppError.validation('Nome do nível é obrigatório');

        const sortOrder = Math.trunc(Number(input.sortOrder));
        if (Number.isNaN(sortOrder) || sortOrder < 0) {
            throw AppError.validation('sortOrder deve ser um inteiro não negativo');
        }

        const existing = await this.progress.findLevel(schoolId, levelId);
        if (!existing) {
            throw AppError.fromCode(ErrorCode.SCHOOL_STUDENT_LEVEL_NOT_FOUND, { levelId });
        }

        let templateCode: string | null = null;
        if (input.templateCode !== undefined && input.templateCode !== null && String(input.templateCode).trim()) {
            templateCode = String(input.templateCode).trim().slice(0, 64);
        }

        try {
            await this.progress.updateLevel({
                schoolId,
                levelId,
                label,
                templateCode,
                sortOrder
            });
        } catch (e: unknown) {
            if (e instanceof QueryFailedError && typeof (e as { driverError?: { errno?: number } }).driverError?.errno === 'number') {
                const errno = (e as { driverError: { errno: number } }).driverError.errno;
                if (errno === 1062) {
                    throw AppError.validation(
                        'Já existe nível com este sort_order ou template_code nesta escola.',
                        { schoolId }
                    );
                }
            }
            throw e;
        }

        const updated = await this.progress.findLevel(schoolId, levelId);
        return {
            id: updated!.id,
            label: updated!.label,
            templateCode: updated!.templateCode,
            sortOrder: updated!.sortOrder,
            createdAt: updated!.createdAt.toISOString(),
            updatedAt: updated!.updatedAt.toISOString()
        };
    }
}
