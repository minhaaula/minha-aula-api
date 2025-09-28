import { SchoolRepository } from '../../ports/repositories/school.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { EnrollmentRequest } from '../../domain/entities/enrollment-request';
import { Uuid } from '../../shared/uuid';

export class CreateEnrollmentRequest {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly requests: EnrollmentRequestRepository
    ) {}

    async exec(input: {
        schoolId: string;
        courseClassId: string;
        requestedForUserId: string;
        requestedForDependentId?: string | null;
        notes?: string | null;
    }): Promise<{
        id: string;
        status: string;
        schoolId: string;
        courseClassId: string;
        requestedForUserId: string;
        requestedForDependentId: string | null;
        createdAt: Date;
    }> {
        const school = await this.schools.findById(input.schoolId);
        if (!school) throw new Error('School not found');

        const courseClass = await this.classes.findById(input.courseClassId);
        if (!courseClass) throw new Error('Course class not found');

        const course = await this.courses.findById(courseClass.courseId);
        if (!course || course.schoolId !== school.id) throw new Error('Course class does not belong to the school');

        const user = await this.users.findById(input.requestedForUserId);
        if (!user) throw new Error('Target user not found');

        let dependentId: string | null = null;
        if (input.requestedForDependentId) {
            const dependent = await this.dependents.findById(input.requestedForDependentId);
            if (!dependent || dependent.userId !== user.id) {
                throw new Error('Dependent not found for the given user');
            }
            dependentId = dependent.id;
            const existingEnrollment = await this.enrollments.findByClassAndDependent(courseClass.id, dependent.id);
            if (existingEnrollment) throw new Error('Dependent already enrolled in this class');
        } else {
            const existingEnrollment = await this.enrollments.findByClassAndUser(courseClass.id, user.id);
            if (existingEnrollment) throw new Error('User already enrolled in this class');
        }

        const existingRequest = await this.requests.findByCourseClassAndTarget({
            courseClassId: courseClass.id,
            userId: user.id,
            dependentId
        });
        if (existingRequest) throw new Error('Enrollment request already exists for this target');

        const request = EnrollmentRequest.create({
            id: Uuid(),
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            requestedForDependentId: dependentId,
            notes: input.notes ?? null
        });

        await this.requests.save(request);

        return {
            id: request.id,
            status: request.status,
            schoolId: request.schoolId,
            courseClassId: request.courseClassId,
            requestedForUserId: request.requestedForUserId,
            requestedForDependentId: request.requestedForDependentId,
            createdAt: request.createdAt
        };
    }
}
