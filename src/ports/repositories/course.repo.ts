import { Course } from '../../domain/entities/course';

export type CourseCategoryInfo = {
    courseId: string;
    category: string | null;
    subcategory: string | null;
};

export type CourseWithSchoolInfo = {
    courseId: string;
    courseName: string;
    courseDescription: string | null;
    schoolId: string;
    schoolName: string;
    schoolCity: string | null;
};

export interface CourseRepository {
    findById(id: string): Promise<Course | null>;
    findByIdIncludingDeleted?(id: string): Promise<Course | null>;
    findBySchoolAndName(schoolId: string, name: string): Promise<Course | null>;
    findBySchoolId(schoolId: string): Promise<Course[]>;
    countActiveBySchoolId?(schoolId: string): Promise<number>;
    save(course: Course): Promise<void>;
    findCategoriesByCourseIds?(courseIds: string[]): Promise<CourseCategoryInfo[]>;
    findAllWithFilters?(filters: {
        name?: string;
        categoryId?: string;
        subcategoryId?: string;
        city?: string;
    }): Promise<CourseWithSchoolInfo[]>;
}
