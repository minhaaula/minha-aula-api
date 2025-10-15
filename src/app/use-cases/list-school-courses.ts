import { CourseRepository } from '../../ports/repositories/course.repo';
import { CategoryRepository } from '../../ports/repositories/category.repo';
import { equalUuid } from '../../shared/normalize-uuid';

export class ListSchoolCourses {
    constructor(
        private readonly courses: CourseRepository,
        private readonly categories: CategoryRepository
    ) {}

    async exec(input: { schoolId: string }): Promise<Array<{
        id: string;
        schoolId: string;
        name: string;
        description: string | null;
        categories: Array<{
            id: string;
            name: string | null;
            subcategories: Array<{ id: string; name: string | null }>;
        }>;
        createdAt: Date;
    }>> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            return [];
        }

        const [courses, categoryCatalog] = await Promise.all([
            this.courses.findBySchoolId(schoolId),
            this.categories.findAllWithSubcategories()
        ]);

        const categoriesById = new Map<string, {
            name: string;
            subcategories: Map<string, string>;
        }>();

        for (const category of categoryCatalog) {
            categoriesById.set(category.id, {
                name: category.name,
                subcategories: new Map(category.subcategories.map((sub) => [sub.id, sub.name]))
            });
        }

        return courses
            .filter((course) => equalUuid(course.schoolId, schoolId))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((course) => ({
                id: course.id,
                schoolId: course.schoolId,
                name: course.name,
                description: course.description,
                categories: course.categories.map((category) => {
                    const categoryInfo = categoriesById.get(category.categoryId);
                    const subcategories = category.subcategoryIds.map((subcategoryId) => ({
                        id: subcategoryId,
                        name: categoryInfo?.subcategories.get(subcategoryId) ?? null
                    }));

                    return {
                        id: category.categoryId,
                        name: categoryInfo?.name ?? null,
                        subcategories
                    };
                }),
                createdAt: course.createdAt
            }));
    }
}
