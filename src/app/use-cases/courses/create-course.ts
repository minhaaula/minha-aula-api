import { CourseRepository } from '../../../ports/repositories/course.repo';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { Course } from '../../../domain/entities/course';
import { Uuid } from '../../../shared/uuid';
import { AppError, ErrorCode } from '../../../shared/errors';

export class CreateCourse {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly courses: CourseRepository
    ) {}

    async exec(input: {
        schoolId: string;
        name: string;
        description?: string | null;
        categories?: Array<{ categoryId: string; subcategoryIds?: string[] }>;
        monthlyPriceCents?: number | null;
    }): Promise<{
        id: string;
        schoolId: string;
        name: string;
        description: string | null;
        categories: Array<{ categoryId: string; subcategoryIds: string[] }>;
        createdAt: Date;
    }> {
        const school = await this.schools.findById(input.schoolId);
        if (!school) throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId: input.schoolId });

        const existingCourse = await this.courses.findBySchoolAndName(school.id, input.name);
        if (existingCourse) {
            throw AppError.fromCode(ErrorCode.ALREADY_EXISTS, { schoolId: school.id, name: input.name });
        }

        const course = Course.create({
            id: Uuid(),
            schoolId: school.id,
            name: input.name,
            description: input.description ?? null,
            categories: input.categories,
            monthlyPriceCents: input.monthlyPriceCents ?? null
        });

        await this.courses.save(course);

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
