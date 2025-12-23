import { SchoolImageCategory } from '../value-objects/school-image-category';

export class SchoolImage {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly key: string,
        public readonly contentType: string,
        public readonly originalFileName: string,
        public readonly category: SchoolImageCategory,
        public readonly createdAt: Date
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        key: string;
        contentType: string;
        originalFileName: string;
        category?: SchoolImageCategory;
        createdAt?: Date;
    }) {
        const schoolId = params.schoolId.trim();
        if (!schoolId) throw new Error('School ID is required');

        const key = params.key.trim();
        if (!key) throw new Error('Image key is required');

        const contentType = params.contentType.trim();
        if (!contentType) throw new Error('Content type is required');

        const originalFileName = params.originalFileName.trim();
        if (!originalFileName) throw new Error('Original file name is required');

        return new SchoolImage(
            params.id,
            schoolId,
            key,
            contentType,
            originalFileName,
            params.category ?? SchoolImageCategory.GALLERY,
            params.createdAt ?? new Date()
        );
    }
}

