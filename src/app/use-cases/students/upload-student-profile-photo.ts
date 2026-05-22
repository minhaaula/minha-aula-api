import type { UserRepository } from '../../../ports/repositories/user.repo';
import type { StorageProviderPort } from '../../../ports/providers/storage-provider.port';
import { AppError } from '../../../shared/errors';
import { canActAsStudent } from '../../../shared/user-student-access';
import { assertSchoolPersonaCannotUseStudentProfileRoutes } from './assert-school-persona-student-profile-fields';
import {
    deleteProfilePhotoFromStorage,
    profilePhotoFileExtension,
    resolveProfilePhotoUrl,
    validateProfilePhotoUpload
} from '../../../shared/profile-photo';
import { Uuid } from '../../../shared/uuid';

export type UploadStudentProfilePhotoInput = {
    userId: string;
    file: Buffer;
    fileName: string;
    contentType: string;
};

export type ProfilePhotoOutput = {
    photoUrl: string | null;
};

export class UploadStudentProfilePhoto {
    constructor(
        private readonly users: UserRepository,
        private readonly storage: StorageProviderPort
    ) {}

    async exec(input: UploadStudentProfilePhotoInput): Promise<ProfilePhotoOutput> {
        const userId = input.userId.trim();
        if (!userId) {
            throw AppError.validation('Usuário inválido');
        }

        const user = await this.users.findById(userId);
        if (!user) {
            throw AppError.notFound('Usuário', { userId });
        }
        if (!canActAsStudent(user)) {
            throw AppError.forbidden('Apenas alunos podem alterar foto de perfil');
        }
        assertSchoolPersonaCannotUseStudentProfileRoutes(user);

        validateProfilePhotoUpload(input.file, input.contentType, input.fileName);

        await deleteProfilePhotoFromStorage(this.storage, user.photoStorageKey);

        const ext = profilePhotoFileExtension(input.contentType, input.fileName);
        const upload = await this.storage.uploadFile({
            file: input.file,
            fileName: `${Uuid()}${ext}`,
            contentType: input.contentType.toLowerCase().split(';')[0].trim(),
            folder: `students/${userId}/profile`
        });

        user.applyPhotoStorageKey(upload.key);
        await this.users.save(user);

        const photoUrl = await resolveProfilePhotoUrl(this.storage, upload.key);
        return { photoUrl };
    }
}
