import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { SchoolImageRepository } from '../../../ports/repositories/school-image.repo';
import { StorageProviderPort } from '../../../ports/providers/storage-provider.port';
import { SchoolImage } from '../../../domain/entities/school-image';
import { SchoolImageCategory, normalizeSchoolImageCategory } from '../../../domain/value-objects/school-image-category';
import { AppError, ErrorCode } from '../../../shared/errors';
import { Uuid } from '../../../shared/uuid';

export interface UploadSchoolImageInput {
    schoolId: string;
    file: Buffer;
    fileName: string;
    contentType: string;
    category?: string;
}

export interface UploadSchoolImageOutput {
    url: string;
    key: string;
    id: string;
}

export class UploadSchoolImage {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly schoolImages: SchoolImageRepository,
        private readonly storage: StorageProviderPort
    ) {}

    async exec(input: UploadSchoolImageInput): Promise<UploadSchoolImageOutput> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, { message: 'School ID is required' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        // Validar tipo de arquivo (apenas imagens)
        const allowedContentTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedContentTypes.includes(input.contentType.toLowerCase())) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Tipo de arquivo não permitido. Apenas imagens são aceitas.',
                contentType: input.contentType
            });
        }

        // Validar tamanho do arquivo (máximo 5MB)
        const maxSizeBytes = 5 * 1024 * 1024; // 5MB
        if (input.file.length > maxSizeBytes) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Arquivo muito grande. Tamanho máximo: 5MB',
                fileSize: input.file.length
            });
        }

        // Normalizar categoria
        const category = normalizeSchoolImageCategory(input.category);

        // LOGO e BANNER: substituir o antigo (máx 1 por escola)
        const singleImageCategories = [SchoolImageCategory.LOGO, SchoolImageCategory.BANNER];
        if (singleImageCategories.includes(category)) {
            const existing = await this.schoolImages.findBySchoolId(schoolId, category);
            for (const img of existing) {
                try {
                    await this.storage.deleteFile(img.key);
                } catch {
                    // Ignorar falha ao deletar do storage
                }
                await this.schoolImages.delete(img.id);
            }
        }

        // Gerar nome único para o arquivo
        const fileExtension = this.getFileExtension(input.fileName);
        const uniqueFileName = `${Uuid()}${fileExtension}`;

        // Upload para o storage (organizar por categoria)
        const uploadResult = await this.storage.uploadFile({
            file: input.file,
            fileName: uniqueFileName,
            contentType: input.contentType,
            folder: `schools/${schoolId}/images/${category.toLowerCase()}`
        });

        // Salvar referência da imagem no banco de dados
        const schoolImage = SchoolImage.create({
            id: Uuid(),
            schoolId,
            key: uploadResult.key,
            contentType: input.contentType,
            originalFileName: input.fileName,
            category
        });

        await this.schoolImages.save(schoolImage);

        return {
            url: uploadResult.url,
            key: uploadResult.key,
            id: schoolImage.id
        };
    }

    private getFileExtension(fileName: string): string {
        const lastDot = fileName.lastIndexOf('.');
        if (lastDot === -1) return '';
        return fileName.substring(lastDot);
    }
}

