import { CourseClassScheduleEntry } from '../../domain/entities/course-class';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { equalUuid } from '../../shared/normalize-uuid';

export class GetCourseClass {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository
    ) {}

    async exec(input: { schoolId: string; courseId: string; classId: string }): Promise<{
        id: string;
        courseId: string;
        label: string;
        classes: ReadonlyArray<CourseClassScheduleEntry>;
        capacity: number | null;
        monthlyPriceCents: number | null;
        createdAt: Date;
    } | null> {
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();
        const classId = input.classId.trim();

        if (!schoolId || !courseId || !classId) {
            return null;
        }

        const course = await this.courses.findById(courseId);
        if (!course || !course.isActive || !equalUuid(course.schoolId, schoolId)) {
            return null;
        }

        const courseClass = await this.classes.findById(classId);
        if (!courseClass || !courseClass.isActive || !equalUuid(courseClass.courseId, course.id)) {
            return null;
        }

        return {
            id: courseClass.id,
            courseId: courseClass.courseId,
            label: courseClass.label,
            classes: courseClass.schedule.map((entry) => ({ ...entry })),
            capacity: courseClass.capacity,
            monthlyPriceCents: courseClass.monthlyPriceCents,
            createdAt: courseClass.createdAt
        };
    }
}
