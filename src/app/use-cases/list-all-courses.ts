import { CourseRepository } from '../../ports/repositories/course.repo';
import { CategoryRepository } from '../../ports/repositories/category.repo';
import { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import { SchoolReviewRepository } from '../../ports/repositories/school-review.repo';
import { SchoolImageCategory } from '../../domain/value-objects/school-image-category';
import type { StorageProviderPort } from '../../ports/providers/storage-provider.port';
import { resolveSchoolCoverImage } from '../utils/resolve-school-cover-image';

export interface ListAllCoursesInput {
    name?: string;
    categoryId?: string;
    subcategoryId?: string;
    city?: string;
}

export interface CourseListItem {
    courseName: string;
    schoolName: string;
    schoolId: string;
    schoolLogo: string | null;
    /** URL da imagem de capa da escola (COVER ou BANNER), quando existir. */
    schoolCover: string | null;
    courseDescription: string | null;
    category: string | null;
    subcategory: string | null;
    /** Cidade da escola (primeiro endereço). */
    schoolCity: string | null;
    /** Estado da escola (primeiro endereço). */
    schoolState: string | null;
    /** Média geral de avaliação da escola (1 a 5), se houver avaliações. */
    schoolRatingAverage: number | null;
    /** Quantidade total de avaliações da escola. */
    schoolReviewsCount: number;
}

export class ListAllCourses {
    constructor(
        private readonly courses: CourseRepository,
        private readonly categories: CategoryRepository,
        private readonly schoolImages?: SchoolImageRepository,
        private readonly storage?: StorageProviderPort,
        private readonly schoolReviews?: SchoolReviewRepository
    ) {}

    async exec(input: ListAllCoursesInput): Promise<{ courses: CourseListItem[] }> {
        if (!this.courses.findAllWithFilters) {
            return { courses: [] };
        }

        // Buscar cursos com filtros
        const coursesData = await this.courses.findAllWithFilters({
            name: input.name?.trim(),
            categoryId: input.categoryId?.trim(),
            subcategoryId: input.subcategoryId?.trim(),
            city: input.city?.trim()
        });

        if (coursesData.length === 0) {
            return { courses: [] };
        }

        // Buscar categorias e subcategorias
        const courseIds = coursesData.map(c => c.courseId);
        const categoriesData = this.courses.findCategoriesByCourseIds
            ? await this.courses.findCategoriesByCourseIds(courseIds)
            : [];
        const categoriesMap = new Map(categoriesData.map(c => [c.courseId, c]));

        const schoolIds = [...new Set(coursesData.map((d) => d.schoolId))];

        const logoMap = new Map<string, string | null>();
        const coverMap = new Map<string, string | null>();
        if (this.schoolImages && this.storage && schoolIds.length > 0) {
            await Promise.all(
                schoolIds.map(async (schoolId) => {
                    try {
                        const images = await this.schoolImages!.findBySchoolId(schoolId);
                        const logoImage = images.find((img) => img.category === SchoolImageCategory.LOGO);
                        const coverImage = resolveSchoolCoverImage(images);

                        logoMap.set(
                            schoolId,
                            logoImage ? await this.storage!.getFileUrl(logoImage.key, 3600) : null
                        );
                        coverMap.set(
                            schoolId,
                            coverImage ? await this.storage!.getFileUrl(coverImage.key, 3600) : null
                        );
                    } catch {
                        logoMap.set(schoolId, null);
                        coverMap.set(schoolId, null);
                    }
                })
            );
        }

        // Média e quantidade de avaliações por escola
        const ratingMap = new Map<string, number>();
        const reviewCountMap = new Map<string, number>();
        if (this.schoolReviews?.getAverageRatingBySchoolIds && schoolIds.length > 0) {
            const ratings = await this.schoolReviews.getAverageRatingBySchoolIds(schoolIds);
            for (const r of ratings) {
                ratingMap.set(r.schoolId, r.averageRating);
                reviewCountMap.set(r.schoolId, r.count);
            }
        }

        // Construir resultado final
        const courses: CourseListItem[] = coursesData.map((data) => {
            const catInfo = categoriesMap.get(data.courseId) || { category: null, subcategory: null };

            return {
                courseName: data.courseName,
                schoolName: data.schoolName,
                schoolId: data.schoolId,
                schoolLogo: this.schoolImages && this.storage ? (logoMap.get(data.schoolId) ?? null) : null,
                schoolCover: this.schoolImages && this.storage ? (coverMap.get(data.schoolId) ?? null) : null,
                courseDescription: data.courseDescription,
                category: catInfo.category,
                subcategory: catInfo.subcategory,
                schoolCity: data.schoolCity ?? null,
                schoolState: data.schoolState ?? null,
                schoolRatingAverage: ratingMap.get(data.schoolId) ?? null,
                schoolReviewsCount: reviewCountMap.get(data.schoolId) ?? 0
            };
        });

        return { courses };
    }
}

