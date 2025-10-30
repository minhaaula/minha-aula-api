import { SchoolRepository } from '../../ports/repositories/school.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { EnrollmentRequest } from '../../domain/entities/enrollment-request';
import { Uuid } from '../../shared/uuid';
import { equalUuid } from '../../shared/normalize-uuid';

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
        discount?: number | null;
        enrollmentFeeAmount?: number | null;
        enrollmentFeeDueDate?: string | null;
        firstMonthlyPaymentDate: string;
    }): Promise<EnrollmentRequest> {
        const schoolId = input.schoolId.trim();
        const courseClassId = input.courseClassId.trim();

        const school = await this.schools.findById(schoolId);
        if (!school) throw new Error('School not found');

        const courseClass = await this.classes.findById(courseClassId);
        if (!courseClass) throw new Error('Course class not found');

        const course = await this.courses.findById(courseClass.courseId);
        if (!course || !equalUuid(course.schoolId, school.id)) throw new Error('Course class does not belong to the school');

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

        let discountCents: number | null = null;
        if (input.discount !== undefined && input.discount !== null) {
            const discountValue = Number(input.discount);
            if (!Number.isFinite(discountValue) || discountValue < 0) {
                throw new Error('Invalid discount value');
            }
            discountCents = Math.round(discountValue * 100);
        }

        let enrollmentFeeCents: number | null = null;
        if (input.enrollmentFeeAmount !== undefined && input.enrollmentFeeAmount !== null) {
            const feeAmount = Number(input.enrollmentFeeAmount);
            if (!Number.isFinite(feeAmount) || feeAmount < 0) {
                throw new Error('Invalid enrollment fee amount');
            }
            enrollmentFeeCents = Math.round(feeAmount * 100);
        }

        const normalizeDate = (value: string, field: string) => {
            if (!value || typeof value !== 'string') {
                throw new Error(`Invalid ${field}`);
            }
            const trimmed = value.trim();
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
            if (!match) {
                throw new Error(`Invalid ${field}`);
            }
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const date = new Date(Date.UTC(year, month - 1, day));
            if (
                Number.isNaN(date.getTime()) ||
                date.getUTCFullYear() !== year ||
                date.getUTCMonth() !== month - 1 ||
                date.getUTCDate() !== day
            ) {
                throw new Error(`Invalid ${field}`);
            }
            return date;
        };

        let enrollmentFeeDueDate: Date | null = null;
        if (input.enrollmentFeeDueDate !== undefined && input.enrollmentFeeDueDate !== null) {
            enrollmentFeeDueDate = normalizeDate(input.enrollmentFeeDueDate, 'enrollment fee due date');
            if (enrollmentFeeCents === null) {
                throw new Error('Enrollment fee due date requires a fee amount');
            }
        }

        const firstMonthlyPaymentDate = normalizeDate(input.firstMonthlyPaymentDate, 'first monthly payment date');

        const request = EnrollmentRequest.create({
            id: Uuid(),
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            requestedForDependentId: dependentId,
            notes: input.notes ?? null,
            discountCents,
            enrollmentFeeCents,
            enrollmentFeeDueDate,
            firstMonthlyPaymentDate
        });

        await this.requests.save(request);

        return request;
    }
}
