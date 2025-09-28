import { Course } from '../../domain/entities/course';

export interface CourseRepository {
    findById(id: string): Promise<Course | null>;
    findBySchoolAndName(schoolId: string, name: string): Promise<Course | null>;
    save(course: Course): Promise<void>;
}
