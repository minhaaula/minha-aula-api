import { Course } from '../../domain/entities/course';

export interface CourseRepository {
    findById(id: string): Promise<Course | null>;
    findBySchoolAndName(schoolId: string, name: string): Promise<Course | null>;
    findBySchoolId(schoolId: string): Promise<Course[]>;
    save(course: Course): Promise<void>;
}
