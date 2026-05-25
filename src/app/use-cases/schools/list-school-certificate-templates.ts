import type { EnrollmentProgressRepository } from '../../../ports/repositories/enrollment-progress.repo';

export class ListSchoolCertificateTemplates {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: { schoolId: string }) {
        const items = await this.progress.listCertificateTemplates(input.schoolId.trim());
        return items.map((t) => ({
            id: t.id,
            name: t.name,
            logicalTemplateId: t.logicalTemplateId,
            layoutConfig: t.layoutConfig,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString()
        }));
    }
}
