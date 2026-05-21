import { CourseClassScheduleEntry } from '../../../domain/entities/course-class';
import { CourseClassRepository } from '../../../ports/repositories/course-class.repo';
import { CourseRepository } from '../../../ports/repositories/course.repo';
import { equalUuid } from '../../../shared/normalize-uuid';

export class ListCourseClasses {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository
    ) {}

    async exec(input: { schoolId: string; courseId?: string | null }): Promise<Array<{
        id: string;
        courseId: string;
        courseName: string;
        label: string;
        classes: ReadonlyArray<CourseClassScheduleEntry>;
        capacity: number | null;
        monthlyPriceCents: number | null;
        classType: 'PRESENCIAL' | 'ONLINE';
        createdAt: Date;
    }> | null> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            return null;
        }

        const courseId = input.courseId?.trim() ?? '';

        if (courseId) {
            const course = await this.courses.findById(courseId);
            if (!course || !course.isActive || !equalUuid(course.schoolId, schoolId)) {
                return null;
            }

            const classes = await this.classes.findByCourseId(course.id);

            return classes
                .filter((courseClass) => equalUuid(courseClass.courseId, course.id))
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .map((courseClass) => ({
                    id: courseClass.id,
                    courseId: courseClass.courseId,
                    courseName: course.name,
                    label: courseClass.label,
                    classes: courseClass.schedule.map((entry) => ({ ...entry })),
                    capacity: courseClass.capacity,
                    monthlyPriceCents: courseClass.monthlyPriceCents,
                    classType: courseClass.classType,
                    createdAt: courseClass.createdAt
                }));
        }

        const courses = await this.courses.findBySchoolId(schoolId);
        if (courses.length === 0) {
            return [];
        }

        const courseIds = courses.map((course) => course.id);
        const classList = await this.classes.findByCourseIds(courseIds);
        const courseMap = new Map(courses.map((course) => [course.id.trim().toLowerCase(), course]));

        return classList
            .filter((courseClass) => {
                const course = courseMap.get(courseClass.courseId.trim().toLowerCase());
                return course && course.isActive && equalUuid(course.schoolId, schoolId);
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((courseClass) => {
                const course = courseMap.get(courseClass.courseId.trim().toLowerCase());
                return {
                    id: courseClass.id,
                    courseId: courseClass.courseId,
                    courseName: course?.name ?? '',
                    label: courseClass.label,
                    classes: courseClass.schedule.map((entry) => ({ ...entry })),
                    capacity: courseClass.capacity,
                    monthlyPriceCents: courseClass.monthlyPriceCents,
                    classType: courseClass.classType,
                    createdAt: courseClass.createdAt
                };
            });
    }
}
