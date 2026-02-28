import { CourseRepository } from '../../ports/repositories/course.repo';
import { CategoryRepository } from '../../ports/repositories/category.repo';
import { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import { SchoolImageCategory } from '../../domain/value-objects/school-image-category';
import type { StorageProviderPort } from '../../ports/providers/storage-provider.port';

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
    courseDescription: string | null;
    category: string | null;
    subcategory: string | null;
}

export class ListAllCourses {
    constructor(
        private readonly courses: CourseRepository,
        private readonly categories: CategoryRepository,
        private readonly schoolImages?: SchoolImageRepository,
        private readonly storage?: StorageProviderPort
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

        // Buscar logos das escolas (se disponíveis)
        const logoMap = new Map<string, string | null>();
        if (this.schoolImages && this.storage) {
            const schoolIds = [...new Set(coursesData.map((d) => d.schoolId))];
            await Promise.all(
                schoolIds.map(async (schoolId) => {
                    try {
                        const logos = await this.schoolImages!.findBySchoolId(schoolId, SchoolImageCategory.LOGO);
                        const logo = logos[0];
                        if (logo) {
                            const url = await this.storage!.getFileUrl(logo.key, 3600);
                            logoMap.set(schoolId, url);
                        } else {
                            logoMap.set(schoolId, null);
                        }
                    } catch {
                        logoMap.set(schoolId, null);
                    }
                })
            );
        }

        // Construir resultado final
        const courses: CourseListItem[] = coursesData.map((data) => {
            const catInfo = categoriesMap.get(data.courseId) || { category: null, subcategory: null };

            return {
                courseName: data.courseName,
                schoolName: data.schoolName,
                schoolId: data.schoolId,
                schoolLogo: this.schoolImages && this.storage ? (logoMap.get(data.schoolId) ?? null) : null,
                courseDescription: data.courseDescription,
                category: catInfo.category,
                subcategory: catInfo.subcategory
            };
        });

        return { courses };
    }
}

