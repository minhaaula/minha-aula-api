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
        console.log(schoolId)
        console.log(courseId)
        if (!schoolId || !courseId) {
            throw new Error('Invalid identifiers');
        }

        let course = await this.courses.findById(courseId);
        if (!course && this.courses.findByIdIncludingDeleted) {
            course = await this.courses.findByIdIncludingDeleted(courseId);
        }

        if (!course || !equalUuid(course.schoolId, schoolId)) {
            return;
        }

        if (course.deletedAt) {
            return;
        }

        const activeClasses = await this.classes.findByCourseId(course.id);
        if (activeClasses.some((courseClass) => courseClass.isActive !== false)) {
            throw new Error('Cannot delete course with active classes');
        }

        course.markAsDeleted();
        await this.courses.save(course);
    }
}
