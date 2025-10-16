import { CourseClass } from '../../domain/entities/course-class';

export interface CourseClassRepository {
    findById(id: string): Promise<CourseClass | null>;
    findByCourseAndLabel(courseId: string, label: string): Promise<CourseClass | null>;
    findByCourseId(courseId: string): Promise<CourseClass[]>;
    findByCourseIds(courseIds: string[]): Promise<CourseClass[]>;
    save(courseClass: CourseClass): Promise<void>;
}
