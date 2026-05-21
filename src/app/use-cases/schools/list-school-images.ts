import { SchoolImageRepository } from '../../../ports/repositories/school-image.repo';
import { StorageProviderPort } from '../../../ports/providers/storage-provider.port';
import { SchoolImageCategory, isValidSchoolImageCategory } from '../../../domain/value-objects/school-image-category';
import { AppError, ErrorCode } from '../../../shared/errors';

export interface ListSchoolImagesInput {
    schoolId: string;
    category?: string;
}

export interface SchoolImageListItem {
    id: string;
    url: string;
    key: string;
    contentType: string;
    originalFileName: string;
    category: string;
    createdAt: Date;
}

export interface ListSchoolImagesOutput {
    images: SchoolImageListItem[];
}

export class ListSchoolImages {
    constructor(
        private readonly schoolImages: SchoolImageRepository,
        private readonly storage: StorageProviderPort
    ) {}

    async exec(input: ListSchoolImagesInput): Promise<ListSchoolImagesOutput> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, { message: 'School ID is required' });
        }

        // Validar categoria se fornecida
        let category: SchoolImageCategory | undefined;
        if (input.category) {
            if (!isValidSchoolImageCategory(input.category.toUpperCase())) {
                throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                    message: 'Categoria de imagem inválida',
                    category: input.category
                });
            }
            category = input.category.toUpperCase() as SchoolImageCategory;
        }

        const images = await this.schoolImages.findBySchoolId(schoolId, category);

        // Gerar URLs assinadas para cada imagem
        const imagesWithUrls: SchoolImageListItem[] = await Promise.all(
            images.map(async (image) => {
                try {
                    const url = await this.storage.getFileUrl(image.key, 3600);
                    return {
                        id: image.id,
                        url,
                        key: image.key,
                        contentType: image.contentType,
                        originalFileName: image.originalFileName,
                        category: image.category,
                        createdAt: image.createdAt
                    };
                } catch (error) {
                    // Se falhar ao gerar URL, retornar sem URL
                    console.warn(`Failed to generate signed URL for image key: ${image.key}`, error);
                    return {
                        id: image.id,
                        url: '',
                        key: image.key,
                        contentType: image.contentType,
                        originalFileName: image.originalFileName,
                        category: image.category,
                        createdAt: image.createdAt
                    };
                }
            })
        );

        return {
            images: imagesWithUrls
        };
    }
}

