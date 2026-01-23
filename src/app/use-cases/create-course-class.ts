import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { CourseClass, type CourseClassScheduleEntry } from '../../domain/entities/course-class';
import { Uuid } from '../../shared/uuid';
import { equalUuid } from '../../shared/normalize-uuid';
import { AppError, ErrorCode } from '../../shared/errors';

export class CreateCourseClass {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository
    ) {}

    async exec(input: {
        schoolId: string;
        courseId: string;
        label: string;
        classes: CourseClassScheduleEntry[];
        capacity?: number | null;
        monthlyPriceCents?: number | null;
        classType?: 'PRESENCIAL' | 'ONLINE';
    }): Promise<{
        id: string;
        courseId: string;
        label: string;
        classes: ReadonlyArray<CourseClassScheduleEntry>;
        capacity: number | null;
        monthlyPriceCents: number | null;
        classType: 'PRESENCIAL' | 'ONLINE';
        createdAt: Date;
    }> {
        const courseId = input.courseId.trim();
        const schoolId = input.schoolId.trim();
        const label = input.label.trim();

        const course = await this.courses.findById(courseId);
        if (!course || !course.isActive || !equalUuid(course.schoolId, schoolId)) {
            throw AppError.fromCode(ErrorCode.COURSE_NOT_FOUND, { courseId, schoolId });
        }

        const existing = await this.classes.findByCourseAndLabel(course.id, label);
        if (existing) throw AppError.fromCode(ErrorCode.ALREADY_EXISTS, { message: 'Class label already in use for this course' });

        const courseClass = CourseClass.create({
            id: Uuid(),
            courseId: course.id,
            label,
            schedule: input.classes,
            capacity: input.capacity ?? null,
            monthlyPriceCents: input.monthlyPriceCents ?? null,
            classType: input.classType ?? 'PRESENCIAL'
        });

        await this.classes.save(courseClass);

        return {
            id: courseClass.id,
            courseId: courseClass.courseId,
            label: courseClass.label,
            classes: courseClass.schedule.map((entry) => ({ ...entry })),
            capacity: courseClass.capacity,
            monthlyPriceCents: courseClass.monthlyPriceCents,
            classType: courseClass.classType,
            createdAt: courseClass.createdAt
        };
    }
}
