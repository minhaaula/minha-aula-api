import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { equalUuid } from '../../shared/normalize-uuid';

export class ListCourseClasses {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository
    ) {}

    async exec(input: { schoolId: string; courseId: string }): Promise<Array<{
        id: string;
        courseId: string;
        label: string;
        shift: string | null;
        capacity: number | null;
        startsAt: Date | null;
        endsAt: Date | null;
        createdAt: Date;
    }> | null> {
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();

        if (!schoolId || !courseId) {
            return null;
        }

        const course = await this.courses.findById(courseId);
        if (!course || !equalUuid(course.schoolId, schoolId)) {
            return null;
        }

        const classes = await this.classes.findByCourseId(course.id);

        return classes
            .filter((courseClass) => equalUuid(courseClass.courseId, course.id))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((courseClass) => ({
                id: courseClass.id,
                courseId: courseClass.courseId,
                label: courseClass.label,
                shift: courseClass.shift,
                capacity: courseClass.capacity,
                startsAt: courseClass.startsAt,
                endsAt: courseClass.endsAt,
                createdAt: courseClass.createdAt
            }));
    }
}
