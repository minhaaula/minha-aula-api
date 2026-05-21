import type { UserRepository } from '../../../ports/repositories/user.repo';
import type { StorageProviderPort } from '../../../ports/providers/storage-provider.port';
import { AppError } from '../../../shared/errors';
import { canActAsStudent } from '../../../shared/user-student-access';
import { deleteProfilePhotoFromStorage } from '../../../shared/profile-photo';
import type { ProfilePhotoOutput } from './upload-student-profile-photo';

export class RemoveStudentProfilePhoto {
    constructor(
        private readonly users: UserRepository,
        private readonly storage: StorageProviderPort
    ) {}

    async exec(input: { userId: string }): Promise<ProfilePhotoOutput> {
        const userId = input.userId.trim();
        const user = await this.users.findById(userId);
        if (!user) {
            throw AppError.notFound('Usuário', { userId });
        }
        if (!canActAsStudent(user)) {
            throw AppError.forbidden('Apenas alunos podem alterar foto de perfil');
        }

        await deleteProfilePhotoFromStorage(this.storage, user.photoStorageKey);
        user.applyPhotoStorageKey(null);
        await this.users.save(user);

        return { photoUrl: null };
    }
}
