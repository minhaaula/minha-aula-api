import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';
import { equalUuid } from '../../shared/normalize-uuid';

export class DeleteCourseClass {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly enrollmentRequests: EnrollmentRequestRepository
    ) {}

    async exec(input: { schoolId: string; courseId: string; classId: string }): Promise<void> {
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

        const pendingStatus: EnrollmentRequestStatus = 'PENDING';

        const [activeEnrollments, pendingRequests] = await Promise.all([
            this.enrollments.findActiveByClassIds([courseClass.id]),
            this.enrollmentRequests.findMany({
                courseClassId: courseClass.id,
                status: pendingStatus,
                limit: 1
            })
        ]);

        if (activeEnrollments.length > 0) {
            throw new Error('Cannot delete class with active enrollments');
        }

        if (pendingRequests.length > 0) {
            throw new Error('Cannot delete class with pending enrollment requests');
        }

        courseClass.deactivate();
        await this.classes.save(courseClass);
    }
}
