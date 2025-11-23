import { DependentRepository } from '../../ports/repositories/dependent.repo';

export interface DependentListItem {
    id: string;
    fullName: string;
    cpf: string | null;
    birthDate: Date | null;
    relationship: string | null;
    createdAt: Date;
}

export class ListMyDependents {
    constructor(
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: { userId: string }): Promise<{ dependents: DependentListItem[] }> {
        const userId = input.userId?.trim();
        if (!userId) {
            return { dependents: [] };
        }

        const dependentsList = await this.dependents.findByUserIds([userId]);

        const dependents: DependentListItem[] = dependentsList.map((dep) => ({
            id: dep.id,
            fullName: dep.fullName,
            cpf: dep.cpf,
            birthDate: dep.birthDate,
            relationship: dep.relationship,
            createdAt: dep.createdAt
        }));

        return { dependents };
    }
}

