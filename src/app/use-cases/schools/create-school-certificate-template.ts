import type { EnrollmentProgressRepository } from '../../../ports/repositories/enrollment-progress.repo';
import { AppError } from '../../../shared/errors';
import { QueryFailedError } from 'typeorm';
import { Uuid } from '../../../shared/uuid';

export class CreateSchoolCertificateTemplate {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: {
        schoolId: string;
        name: string;
        logicalTemplateId: string;
        layoutConfig?: Record<string, unknown> | null;
    }) {
        const schoolId = input.schoolId.trim();
        const name = input.name.trim();
        const logicalTemplateId = input.logicalTemplateId.trim().slice(0, 64);
        if (!name) throw AppError.validation('Nome do template é obrigatório');
        if (!logicalTemplateId) throw AppError.validation('logicalTemplateId é obrigatório');

        const id = Uuid();
        try {
            await this.progress.createCertificateTemplate({
                id,
                schoolId,
                name,
                logicalTemplateId,
                layoutConfig: input.layoutConfig ?? null
            });
        } catch (e: unknown) {
            if (e instanceof QueryFailedError && typeof (e as { driverError?: { errno?: number } }).driverError?.errno === 'number') {
                const errno = (e as { driverError: { errno: number } }).driverError.errno;
                if (errno === 1062) {
                    throw AppError.validation('Já existe template com este logical_template_id nesta escola.', {
                        logicalTemplateId
                    });
                }
            }
            throw e;
        }

        const created = await this.progress.findCertificateTemplate(schoolId, id);
        return {
            id: created!.id,
            name: created!.name,
            logicalTemplateId: created!.logicalTemplateId,
            layoutConfig: created!.layoutConfig,
            createdAt: created!.createdAt.toISOString(),
            updatedAt: created!.updatedAt.toISOString()
        };
    }
}
