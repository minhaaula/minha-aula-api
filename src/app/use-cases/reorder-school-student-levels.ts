import type { EnrollmentProgressRepository } from '../../ports/repositories/enrollment-progress.repo';
import { AppError } from '../../shared/errors';

export class ReorderSchoolStudentLevels {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: {
        schoolId: string;
        levels: Array<{ id: string; sortOrder: number }>;
    }) {
        const schoolId = input.schoolId.trim();
        const items = input.levels.map((l) => ({
            id: l.id.trim(),
            sortOrder: Math.trunc(Number(l.sortOrder))
        }));

        if (items.length === 0) {
            throw AppError.validation('Informe ao menos um nível para reordenar');
        }
        if (items.some((i) => !i.id || Number.isNaN(i.sortOrder) || i.sortOrder < 0)) {
            throw AppError.validation('Cada nível deve ter id e sortOrder válido');
        }

        const existing = await this.progress.listLevels(schoolId);
        if (items.length !== existing.length) {
            throw AppError.validation('Envie todos os níveis da escola com a nova ordem', {
                expected: existing.length,
                received: items.length
            });
        }

        const existingIds = new Set(existing.map((l) => l.id));
        for (const item of items) {
            if (!existingIds.has(item.id)) {
                throw AppError.validation('Nível não pertence a esta escola', { levelId: item.id });
            }
        }

        const sortOrders = new Set(items.map((i) => i.sortOrder));
        if (sortOrders.size !== items.length) {
            throw AppError.validation('sortOrder deve ser único por nível');
        }

        await this.progress.reorderLevels(schoolId, items);

        const levels = await this.progress.listLevels(schoolId);
        return {
            levels: levels.map((l) => ({
                id: l.id,
                label: l.label,
                templateCode: l.templateCode,
                sortOrder: l.sortOrder,
                createdAt: l.createdAt.toISOString(),
                updatedAt: l.updatedAt.toISOString()
            }))
        };
    }
}
