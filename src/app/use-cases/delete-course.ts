import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { equalUuid } from '../../shared/normalize-uuid';

export class DeleteCourse {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository
    ) {}

    async exec(input: { schoolId: string; courseId: string }): Promise<void> {
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();

        if (!schoolId || !courseId) {
            throw new Error('Invalid identifiers');
        }

        const course = await this.courses.findById(courseId);
        if (!course || !equalUuid(course.schoolId, schoolId) || !course.isActive) {
            throw new Error('Course not found for this school');
        }

        const activeClasses = await this.classes.findByCourseId(course.id);
        if (activeClasses.length > 0) {
            throw new Error('Cannot delete course with active classes');
        }

        course.deactivate();
        await this.courses.save(course);
    }
}
