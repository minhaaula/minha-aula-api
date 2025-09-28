import { CourseClass } from '../../domain/entities/course-class';

export interface CourseClassRepository {
    findById(id: string): Promise<CourseClass | null>;
    findByCourseAndLabel(courseId: string, label: string): Promise<CourseClass | null>;
    save(courseClass: CourseClass): Promise<void>;
}
