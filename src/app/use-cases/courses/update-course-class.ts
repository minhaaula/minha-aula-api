import { CourseClass, CourseClassScheduleEntry } from '../../../domain/entities/course-class';
import { CourseClassRepository } from '../../../ports/repositories/course-class.repo';
import { CourseRepository } from '../../../ports/repositories/course.repo';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { equalUuid } from '../../../shared/normalize-uuid';
import { AppError, ErrorCode } from '../../../shared/errors';
import { assertNonprofitSchoolAllowsClassMonthlyPrice } from '../../../shared/nonprofit-school';

export class UpdateCourseClass {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly schools: SchoolRepository
    ) {}

    async exec(input: {
        schoolId: string;
        courseId: string;
        classId: string;
        label?: string;
        classes?: CourseClassScheduleEntry[];
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
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();
        const classId = input.classId.trim();

        if (!schoolId || !courseId || !classId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, { schoolId, courseId, classId });
        }

        const course = await this.courses.findById(courseId);
        if (!course || !equalUuid(course.schoolId, schoolId) || !course.isActive) {
            throw AppError.fromCode(ErrorCode.COURSE_NOT_FOUND, { courseId, schoolId });
        }

        const courseClass = await this.classes.findById(classId);
        if (!courseClass || !equalUuid(courseClass.courseId, course.id) || !courseClass.isActive) {
            throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, { classId, courseId });
        }

        let label = input.label !== undefined ? input.label.trim() : courseClass.label;
        if (!label) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'label' });
        }

        if (label !== courseClass.label) {
            const duplicate = await this.classes.findByCourseAndLabel(course.id, label);
            if (duplicate && duplicate.id !== courseClass.id) {
                throw AppError.fromCode(ErrorCode.ALREADY_EXISTS, { courseId, classId, label: input.label });
            }
        }

        const schedule = input.classes !== undefined
            ? input.classes
            : courseClass.schedule.map((entry) => ({ ...entry }));

        const capacity = input.capacity !== undefined
            ? input.capacity ?? null
            : courseClass.capacity;

        const monthlyPriceCents = input.monthlyPriceCents !== undefined
            ? input.monthlyPriceCents ?? null
            : courseClass.monthlyPriceCents;

        const school = await this.schools.findById(course.schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId: course.schoolId });
        }

        assertNonprofitSchoolAllowsClassMonthlyPrice(
            school.isNonprofitAssociation,
            monthlyPriceCents,
            course.monthlyPriceCents
        );

        const classType = input.classType !== undefined
            ? input.classType
            : courseClass.classType;

        const updatedClass = CourseClass.create({
            id: courseClass.id,
            courseId: courseClass.courseId,
            label,
            schedule,
            capacity,
            monthlyPriceCents,
            classType,
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
            monthlyPriceCents: updatedClass.monthlyPriceCents,
            classType: updatedClass.classType,
            createdAt: updatedClass.createdAt
        };
    }
}
