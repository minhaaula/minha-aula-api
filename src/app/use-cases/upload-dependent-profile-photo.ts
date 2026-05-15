import type { DependentRepository } from '../../ports/repositories/dependent.repo';
import type { StorageProviderPort } from '../../ports/providers/storage-provider.port';
import { AppError, ErrorCode } from '../../shared/errors';
import { equalUuid } from '../../shared/normalize-uuid';
import {
    deleteProfilePhotoFromStorage,
    profilePhotoFileExtension,
    resolveProfilePhotoUrl,
    validateProfilePhotoUpload
} from '../../shared/profile-photo';
import { Uuid } from '../../shared/uuid';
import type { ProfilePhotoOutput } from './upload-student-profile-photo';

export type UploadDependentProfilePhotoInput = {
    ownerUserId: string;
    dependentId: string;
    file: Buffer;
    fileName: string;
    contentType: string;
};

export class UploadDependentProfilePhoto {
    constructor(
        private readonly dependents: DependentRepository,
        private readonly storage: StorageProviderPort
    ) {}

    async exec(input: UploadDependentProfilePhotoInput): Promise<ProfilePhotoOutput> {
        const ownerUserId = input.ownerUserId.trim();
        const dependentId = input.dependentId.trim();

        const dependent = await this.dependents.findById(dependentId);
        if (!dependent || dependent.deletedAt) {
            throw AppError.fromCode(ErrorCode.DEPENDENT_NOT_FOUND, { dependentId });
        }
        if (!equalUuid(dependent.userId, ownerUserId)) {
            throw AppError.forbidden('Dependente não pertence ao usuário autenticado');
        }

        validateProfilePhotoUpload(input.file, input.contentType, input.fileName);

        await deleteProfilePhotoFromStorage(this.storage, dependent.photoStorageKey);

        const ext = profilePhotoFileExtension(input.contentType, input.fileName);
        const upload = await this.storage.uploadFile({
            file: input.file,
            fileName: `${Uuid()}${ext}`,
            contentType: input.contentType.toLowerCase().split(';')[0].trim(),
            folder: `students/${ownerUserId}/dependents/${dependentId}/profile`
        });

        dependent.applyPhotoStorageKey(upload.key);
        await this.dependents.save(dependent);

        const photoUrl = await resolveProfilePhotoUrl(this.storage, upload.key);
        return { photoUrl };
    }
}
