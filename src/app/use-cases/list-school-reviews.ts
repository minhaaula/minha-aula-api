import { SchoolReviewRepository } from '../../ports/repositories/school-review.repo';
import { StorageProviderPort } from '../../ports/providers/storage-provider.port';

export interface SchoolReviewListItem {
    id: string;
    rating: number;
    description: string | null;
    studentName: string;
    studentPhotoUrl: string | null;
    createdAt: Date;
}

export class ListSchoolReviews {
    constructor(
        private readonly reviews: SchoolReviewRepository,
        private readonly storageProvider?: StorageProviderPort
    ) {}

    async exec(input: {
        schoolId: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        reviews: SchoolReviewListItem[];
        total?: number;
    }> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            return { reviews: [] };
        }

        const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
        const offset = Math.max(0, input.offset ?? 0);

        const reviewsWithUserInfo = await this.reviews.findMany({
            schoolId,
            limit,
            offset
        });

        // Converter photoUrl para signed URL se necessário
        const reviews: SchoolReviewListItem[] = await Promise.all(
            reviewsWithUserInfo.map(async (item) => {
                let photoUrl = item.studentPhotoUrl;

                // Se tiver photoUrl e storageProvider, verificar se precisa gerar signed URL
                if (photoUrl && this.storageProvider) {
                    // Se photoUrl não começa com http, é uma key -> converter para signed URL
                    if (!photoUrl.startsWith('http://') && !photoUrl.startsWith('https://')) {
                        try {
                            // Gerar signed URL válida por 1 hora (3600 segundos)
                            photoUrl = await this.storageProvider.getFileUrl(photoUrl, 3600);
                        } catch (error) {
                            // Se falhar ao gerar signed URL, manter o valor original
                            console.warn(`Failed to generate signed URL for key: ${photoUrl}`, error);
                        }
                    }
                    // Se já for uma URL completa, manter como está (pode ser signed URL já expirada)
                    // Em produção, você pode querer sempre regenerar signed URLs
                }

                return {
                    id: item.review.id,
                    rating: item.review.rating,
                    description: item.review.description,
                    studentName: item.studentName,
                    studentPhotoUrl: photoUrl,
                    createdAt: item.review.createdAt
                };
            })
        );

        return { reviews };
    }
}

