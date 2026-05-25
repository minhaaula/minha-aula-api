import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import type { StorageProviderPort } from '../../../ports/providers/storage-provider.port';
import { resolveProfilePhotoUrl } from '../../../shared/profile-photo';
import type { Gender } from '../../../domain/value-objects/gender';

export interface DependentListItem {
    id: string;
    fullName: string;
    cpf: string | null;
    birthDate: Date | null;
    relationship: string | null;
    gender: Gender | null;
    createdAt: Date;
    photoUrl: string | null;
}

export class ListMyDependents {
    constructor(
        private readonly dependents: DependentRepository,
        private readonly storage?: StorageProviderPort
    ) {}

    async exec(input: { userId: string }): Promise<{ dependents: DependentListItem[] }> {
        const userId = input.userId?.trim();
        if (!userId) {
            return { dependents: [] };
        }

        const dependentsList = await this.dependents.findByUserIds([userId]);

        const dependents: DependentListItem[] = await Promise.all(
            dependentsList.map(async (dep) => ({
                id: dep.id,
                fullName: dep.fullName,
                cpf: dep.cpf,
                birthDate: dep.birthDate,
                relationship: dep.relationship,
                gender: dep.gender,
                createdAt: dep.createdAt,
                photoUrl: this.storage
                    ? await resolveProfilePhotoUrl(this.storage, dep.photoStorageKey)
                    : dep.photoStorageKey
            }))
        );

        return { dependents };
    }
}

