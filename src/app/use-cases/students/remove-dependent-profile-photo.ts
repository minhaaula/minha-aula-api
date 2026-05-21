import type { DependentRepository } from '../../../ports/repositories/dependent.repo';
import type { StorageProviderPort } from '../../../ports/providers/storage-provider.port';
import { AppError, ErrorCode } from '../../../shared/errors';
import { equalUuid } from '../../../shared/normalize-uuid';
import { deleteProfilePhotoFromStorage } from '../../../shared/profile-photo';
import type { ProfilePhotoOutput } from './upload-student-profile-photo';

export class RemoveDependentProfilePhoto {
    constructor(
        private readonly dependents: DependentRepository,
        private readonly storage: StorageProviderPort
    ) {}

    async exec(input: { ownerUserId: string; dependentId: string }): Promise<ProfilePhotoOutput> {
        const ownerUserId = input.ownerUserId.trim();
        const dependentId = input.dependentId.trim();

        const dependent = await this.dependents.findById(dependentId);
        if (!dependent || dependent.deletedAt) {
            throw AppError.fromCode(ErrorCode.DEPENDENT_NOT_FOUND, { dependentId });
        }
        if (!equalUuid(dependent.userId, ownerUserId)) {
            throw AppError.forbidden('Dependente não pertence ao usuário autenticado');
        }

        await deleteProfilePhotoFromStorage(this.storage, dependent.photoStorageKey);
        dependent.applyPhotoStorageKey(null);
        await this.dependents.save(dependent);

        return { photoUrl: null };
    }
}
