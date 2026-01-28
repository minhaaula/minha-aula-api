import { CourseRepository } from '../../ports/repositories/course.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { Course } from '../../domain/entities/course';
import { AppError, ErrorCode } from '../../shared/errors';

export class UpdateCourse {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly courses: CourseRepository
    ) {}

    async exec(input: {
        schoolId: string;
        courseId: string;
        name?: string;
        description?: string | null;
        categories?: Array<{ categoryId: string; subcategoryIds?: string[] }>;
    }): Promise<{
        id: string;
        schoolId: string;
        name: string;
        description: string | null;
        categories: Array<{ categoryId: string; subcategoryIds: string[] }>;
        createdAt: Date;
    }> {
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();

        if (!schoolId) throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        if (!courseId) throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'courseId' });

        const school = await this.schools.findById(schoolId);
        if (!school) throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });

        const existingCourse = await this.courses.findById(courseId);
        if (!existingCourse || existingCourse.schoolId !== school.id) {
            throw AppError.fromCode(ErrorCode.COURSE_NOT_FOUND, { courseId, schoolId });
        }

        let name = input.name ?? existingCourse.name;
        name = name.trim();
        if (!name) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'name' });
        }

        if (name !== existingCourse.name) {
            const duplicate = await this.courses.findBySchoolAndName(school.id, name);
            if (duplicate && duplicate.id !== existingCourse.id) {
                throw AppError.fromCode(ErrorCode.ALREADY_EXISTS, { message: 'Course name already in use for this school' });
            }
        }

        const description = input.description !== undefined
            ? (input.description === null ? null : input.description)
            : existingCourse.description;

        const categories = input.categories !== undefined
            ? input.categories
            : existingCourse.categories;

        const updatedCourse = Course.create({
            id: existingCourse.id,
            schoolId: school.id,
            name,
            description,
            categories,
            isActive: existingCourse.isActive,
            createdAt: existingCourse.createdAt
        });

        await this.courses.save(updatedCourse);

        return {
            id: updatedCourse.id,
            schoolId: updatedCourse.schoolId,
            name: updatedCourse.name,
            description: updatedCourse.description,
            categories: updatedCourse.categories,
            createdAt: updatedCourse.createdAt
        };
    }
}
