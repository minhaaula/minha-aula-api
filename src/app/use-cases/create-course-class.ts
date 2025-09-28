import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { CourseClass } from '../../domain/entities/course-class';
import { Uuid } from '../../shared/uuid';
import { equalUuid } from '../../shared/normalize-uuid';

export class CreateCourseClass {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository
    ) {}

    async exec(input: {
        schoolId: string;
        courseId: string;
        label: string;
        shift?: string | null;
        capacity?: number | null;
        startsAt?: Date | null;
        endsAt?: Date | null;
    }): Promise<{
        id: string;
        courseId: string;
        label: string;
        shift: string | null;
        capacity: number | null;
        startsAt: Date | null;
        endsAt: Date | null;
        createdAt: Date;
    }> {
        const courseId = input.courseId.trim();
        const schoolId = input.schoolId.trim();
        const label = input.label.trim();

        const course = await this.courses.findById(courseId);
        if (!course || !equalUuid(course.schoolId, schoolId)) {
            throw new Error('Course not found for this school');
        }

        const existing = await this.classes.findByCourseAndLabel(course.id, label);
        if (existing) throw new Error('Class label already in use for this course');

        const courseClass = CourseClass.create({
            id: Uuid(),
            courseId: course.id,
            label,
            shift: input.shift ?? null,
            capacity: input.capacity ?? null,
            startsAt: input.startsAt ?? null,
            endsAt: input.endsAt ?? null
        });

        await this.classes.save(courseClass);

        return {
            id: courseClass.id,
            courseId: courseClass.courseId,
            label: courseClass.label,
            shift: courseClass.shift,
            capacity: courseClass.capacity,
            startsAt: courseClass.startsAt,
            endsAt: courseClass.endsAt,
            createdAt: courseClass.createdAt
        };
    }
}
