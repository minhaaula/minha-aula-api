import { CourseRepository } from '../../../ports/repositories/course.repo';
import { equalUuid } from '../../../shared/normalize-uuid';

export class GetSchoolCourse {
    constructor(private readonly courses: CourseRepository) {}

    async exec(input: { schoolId: string; courseId: string }): Promise<{
        id: string;
        schoolId: string;
        name: string;
        description: string | null;
        categories: Array<{ categoryId: string; subcategoryIds: string[] }>;
        createdAt: Date;
    } | null> {
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();

        if (!schoolId || !courseId) {
            return null;
        }

        const course = await this.courses.findById(courseId);
        if (!course || course.deletedAt || !course.isActive || !equalUuid(course.schoolId, schoolId)) {
            return null;
        }

        return {
            id: course.id,
            schoolId: course.schoolId,
            name: course.name,
            description: course.description,
            categories: course.categories,
            createdAt: course.createdAt
        };
    }
}
