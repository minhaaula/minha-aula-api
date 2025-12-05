import { CourseRepository } from '../../ports/repositories/course.repo';
import { CategoryRepository } from '../../ports/repositories/category.repo';

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
    courseDescription: string | null;
    category: string | null;
    subcategory: string | null;
}

export class ListAllCourses {
    constructor(
        private readonly courses: CourseRepository,
        private readonly categories: CategoryRepository
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

        // Construir resultado final
        const courses: CourseListItem[] = coursesData.map((data) => {
            const catInfo = categoriesMap.get(data.courseId) || { category: null, subcategory: null };

            return {
                courseName: data.courseName,
                schoolName: data.schoolName,
                schoolId: data.schoolId,
                courseDescription: data.courseDescription,
                category: catInfo.category,
                subcategory: catInfo.subcategory
            };
        });

        return { courses };
    }
}

