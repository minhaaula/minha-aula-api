import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { Enrollment } from '../../domain/entities/enrollment';
import { EnrollmentRequest } from '../../domain/entities/enrollment-request';
import { SchoolFinancialCharge } from '../../domain/entities/school-financial-charge';
import { Uuid } from '../../shared/uuid';

export class ApproveEnrollmentRequest {
    constructor(
        private readonly requests: EnrollmentRequestRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly classes: CourseClassRepository,
        private readonly financialCharges: SchoolFinancialChargeRepository
    ) {}

    async exec(input: { requestId: string; approverUserId: string; notes?: string | null; }): Promise<{ requestId: string; enrollmentId: string; status: string; enrollmentFeeChargeId: string | null; }> {
        const request = await this.requests.findById(input.requestId);
        if (!request) throw new Error('Enrollment request not found');

        if (request.status !== 'PENDING') throw new Error('Enrollment request already decided');
        if (request.requestedForUserId !== input.approverUserId) {
            throw new Error('User not allowed to approve this enrollment request');
        }

        if (request.requestedForDependentId) {
            const existing = await this.enrollments.findByClassAndDependent(request.courseClassId, request.requestedForDependentId);
            if (existing) throw new Error('Dependent already enrolled in this class');
        } else {
            const existing = await this.enrollments.findByClassAndUser(request.courseClassId, request.requestedForUserId);
            if (existing) throw new Error('User already enrolled in this class');
        }

        const enrollmentId = Uuid();
        const enrollment = request.requestedForDependentId
            ? Enrollment.createForDependent({
                id: enrollmentId,
                courseClassId: request.courseClassId,
                ownerUserId: request.requestedForUserId,
                dependentId: request.requestedForDependentId
            })
            : Enrollment.createForUser({
                id: enrollmentId,
                courseClassId: request.courseClassId,
                ownerUserId: request.requestedForUserId,
                studentUserId: request.requestedForUserId
            });

        const pendingCharge = await this.buildEnrollmentCharge(request);

        await this.enrollments.save(enrollment);
        if (pendingCharge) {
            await this.financialCharges.save(pendingCharge);
        }

        request.approve({
            decidedByUserId: input.approverUserId,
            enrollmentId: enrollment.id,
            notes: input.notes ?? null
        });

        await this.requests.save(request);

        return {
            requestId: request.id,
            enrollmentId: enrollment.id,
            status: request.status,
            enrollmentFeeChargeId: pendingCharge ? pendingCharge.id : null
        };
    }

    private async buildEnrollmentCharge(request: EnrollmentRequest): Promise<SchoolFinancialCharge | null> {
        if (!request.enrollmentFeeCents || request.enrollmentFeeCents <= 0) {
            return null;
        }

        const courseClass = await this.classes.findById(request.courseClassId);
        if (!courseClass) {
            throw new Error('Course class not found for enrollment request');
        }

        const dueDate = request.enrollmentFeeDueDate ?? request.firstMonthlyPaymentDate;

        return SchoolFinancialCharge.create({
            id: Uuid(),
            schoolId: request.schoolId,
            ownerUserId: request.requestedForUserId,
            studentUserId: request.requestedForUserId,
            dependentId: request.requestedForDependentId,
            courseId: courseClass.courseId,
            courseClassId: courseClass.id,
            chargeType: 'ENROLLMENT',
            description: 'Enrollment fee',
            amountCents: request.enrollmentFeeCents,
            dueDate
        });
    }
}
