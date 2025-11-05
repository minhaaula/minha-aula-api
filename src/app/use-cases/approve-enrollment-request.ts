import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { AppError, ErrorCode } from '../../shared/errors';
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
        if (!request) {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_REQUEST_NOT_FOUND, { requestId: input.requestId });
        }

        if (request.status !== 'PENDING') {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_REQUEST_ALREADY_DECIDED, {
                requestId: input.requestId,
                status: request.status
            });
        }
        
        if (request.requestedForUserId !== input.approverUserId) {
            throw AppError.fromCode(ErrorCode.NOT_ALLOWED, {
                message: 'Usuário não autorizado a aprovar esta solicitação de matrícula'
            });
        }

        if (request.requestedForDependentId) {
            const existing = await this.enrollments.findByClassAndDependent(request.courseClassId, request.requestedForDependentId);
            if (existing) {
                throw AppError.fromCode(ErrorCode.ALREADY_ENROLLED, {
                    courseClassId: request.courseClassId,
                    dependentId: request.requestedForDependentId
                });
            }
        } else {
            const existing = await this.enrollments.findByClassAndUser(request.courseClassId, request.requestedForUserId);
            if (existing) {
                throw AppError.fromCode(ErrorCode.ALREADY_ENROLLED, {
                    courseClassId: request.courseClassId,
                    userId: request.requestedForUserId
                });
            }
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
            throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, {
                courseClassId: request.courseClassId,
                requestId: request.id
            });
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
