import { SchoolImageCategory } from '../../domain/value-objects/school-image-category';
import type { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import type { StorageProviderPort } from '../../ports/providers/storage-provider.port';

export async function resolveSchoolLogoUrl(
    schoolId: string,
    schoolImages?: SchoolImageRepository,
    storage?: StorageProviderPort | null,
    expiresInSeconds = 3600
): Promise<string | null> {
    if (!schoolImages || !storage) {
        return null;
    }
    try {
        const logos = await schoolImages.findBySchoolId(schoolId, SchoolImageCategory.LOGO);
        const logo = logos[0];
        if (!logo) {
            return null;
        }
        return await storage.getFileUrl(logo.key, expiresInSeconds);
    } catch {
        return null;
    }
}
