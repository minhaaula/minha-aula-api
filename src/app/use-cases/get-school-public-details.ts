import { SchoolRepository } from '../../ports/repositories/school.repo';
import { type PostalAddressProps } from '../../domain/value-objects/postal-address';
import { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import { StorageProviderPort } from '../../ports/providers/storage-provider.port';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { SchoolReviewRepository } from '../../ports/repositories/school-review.repo';

export class GetSchoolPublicDetails {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly schoolImages?: SchoolImageRepository,
        private readonly storage?: StorageProviderPort,
        private readonly enrollments?: EnrollmentRepository,
        private readonly reviews?: SchoolReviewRepository
    ) {}

    async exec(input: { schoolId: string; userId?: string }): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string;
        addresses: PostalAddressProps[];
        links: {
            facebook: string | null;
            instagram: string | null;
            tiktok: string | null;
            youtube: string | null;
            site: string | null;
        };
        images: Array<{
            id: string;
            url: string;
            key: string;
            contentType: string;
            originalFileName: string;
            category: string;
            createdAt: Date;
        }>;
        createdAt: Date;
        canReview: boolean;
    } | null> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) return null;

        const school = await this.schools.findById(schoolId);
        if (!school) {
            return null;
        }

        let images: Array<{
            id: string;
            url: string;
            key: string;
            contentType: string;
            originalFileName: string;
            category: string;
            createdAt: Date;
        }> = [];

        if (this.schoolImages && this.storage) {
            const schoolImages = await this.schoolImages.findBySchoolId(schoolId);
            images = await Promise.all(
                schoolImages.map(async (image) => {
                    try {
                        const url = await this.storage!.getFileUrl(image.key, 3600);
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
        }

        // canReview = true apenas quando: (1) aluno está matriculado na escola E (2) ainda não avaliou a escola
        let canReview = false;
        if (input.userId && this.enrollments && this.reviews) {
            const userId = input.userId.trim();

            const hasEnrollment =
                this.enrollments.hasActiveEnrollmentInSchool &&
                (await this.enrollments.hasActiveEnrollmentInSchool(schoolId, userId));

            if (!hasEnrollment) {
                canReview = false;
            } else if (this.reviews.findByUserAndSchool) {
                const existingReview = await this.reviews.findByUserAndSchool(userId, schoolId);
                canReview = existingReview === null;
            }
        }

        return {
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            links: {
                facebook: school.facebookLink,
                instagram: school.instagramLink,
                tiktok: school.tiktokLink,
                youtube: school.youtubeLink,
                site: school.siteLink
            },
            images,
            createdAt: school.createdAt,
            canReview
        };
    }
}

