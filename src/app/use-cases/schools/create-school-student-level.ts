import type { EnrollmentProgressRepository } from '../../../ports/repositories/enrollment-progress.repo';
import { AppError } from '../../../shared/errors';
import { QueryFailedError } from 'typeorm';
import { Uuid } from '../../../shared/uuid';

export class CreateSchoolStudentLevel {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: { schoolId: string; label: string; sortOrder: number; templateCode?: string | null }) {
        const schoolId = input.schoolId.trim();
        const label = input.label.trim();
        if (!label) throw AppError.validation('Nome do nível é obrigatório');
        const sortOrder = Math.trunc(Number(input.sortOrder));
        if (Number.isNaN(sortOrder) || sortOrder < 0) {
            throw AppError.validation('sortOrder deve ser um inteiro não negativo');
        }
        let templateCode: string | null = null;
        if (input.templateCode !== undefined && input.templateCode !== null && String(input.templateCode).trim()) {
            templateCode = String(input.templateCode).trim().slice(0, 64);
        }

        const id = Uuid();
        try {
            await this.progress.createLevel({
                id,
                schoolId,
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

        const created = await this.progress.findLevel(schoolId, id);
        return {
            id: created!.id,
            label: created!.label,
            templateCode: created!.templateCode,
            sortOrder: created!.sortOrder,
            createdAt: created!.createdAt.toISOString(),
            updatedAt: created!.updatedAt.toISOString()
        };
    }
}
