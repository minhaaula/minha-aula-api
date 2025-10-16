import { CourseClass, CourseClassScheduleEntry } from '../../domain/entities/course-class';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { equalUuid } from '../../shared/normalize-uuid';

export class UpdateCourseClass {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository
    ) {}

    async exec(input: {
        schoolId: string;
        courseId: string;
        classId: string;
        label?: string;
        classes?: CourseClassScheduleEntry[];
        capacity?: number | null;
    }): Promise<{
        id: string;
        courseId: string;
        label: string;
        classes: ReadonlyArray<CourseClassScheduleEntry>;
        capacity: number | null;
        createdAt: Date;
    }> {
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();
        const classId = input.classId.trim();

        if (!schoolId || !courseId || !classId) {
            throw new Error('Invalid identifiers');
        }

        const course = await this.courses.findById(courseId);
        if (!course || !equalUuid(course.schoolId, schoolId) || !course.isActive) {
            throw new Error('Course not found for this school');
        }

        const courseClass = await this.classes.findById(classId);
        if (!courseClass || !equalUuid(courseClass.courseId, course.id) || !courseClass.isActive) {
            throw new Error('Course class not found for this course');
        }

        let label = input.label !== undefined ? input.label.trim() : courseClass.label;
        if (!label) {
            throw new Error('Class label is required');
        }

        if (label !== courseClass.label) {
            const duplicate = await this.classes.findByCourseAndLabel(course.id, label);
            if (duplicate && duplicate.id !== courseClass.id) {
                throw new Error('Class label already in use for this course');
            }
        }

        const schedule = input.classes !== undefined
            ? input.classes
            : courseClass.schedule.map((entry) => ({ ...entry }));

        const capacity = input.capacity !== undefined
            ? input.capacity ?? null
            : courseClass.capacity;

        const updatedClass = CourseClass.create({
            id: courseClass.id,
            courseId: courseClass.courseId,
            label,
            schedule,
            capacity,
            isActive: courseClass.isActive,
            createdAt: courseClass.createdAt
        });

        await this.classes.save(updatedClass);

        return {
            id: updatedClass.id,
            courseId: updatedClass.courseId,
            label: updatedClass.label,
            classes: updatedClass.schedule.map((entry) => ({ ...entry })),
            capacity: updatedClass.capacity,
            createdAt: updatedClass.createdAt
        };
    }
}
