import { CourseRepository } from '../../ports/repositories/course.repo';
import { equalUuid } from '../../shared/normalize-uuid';

export class ListSchoolCourses {
    constructor(private readonly courses: CourseRepository) {}

    async exec(input: { schoolId: string }): Promise<Array<{
        id: string;
        schoolId: string;
        name: string;
        description: string | null;
        categories: Array<{ categoryId: string; subcategoryIds: string[] }>;
        createdAt: Date;
    }>> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            return [];
        }

        const courses = await this.courses.findBySchoolId(schoolId);

        return courses
            .filter((course) => equalUuid(course.schoolId, schoolId))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((course) => ({
                id: course.id,
                schoolId: course.schoolId,
                name: course.name,
                description: course.description,
                categories: course.categories,
                createdAt: course.createdAt
            }));
    }
}
