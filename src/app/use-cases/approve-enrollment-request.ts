import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { AppError, ErrorCode } from '../../shared/errors';
import { Enrollment } from '../../domain/entities/enrollment';
import { EnrollmentRequest } from '../../domain/entities/enrollment-request';
import { SchoolFinancialCharge } from '../../domain/entities/school-financial-charge';
import { Uuid } from '../../shared/uuid';
import type { ApproveEnrollmentRequestInput, ApproveEnrollmentRequestOutput } from '../types/enrollment.types';

export class ApproveEnrollmentRequest {
    constructor(
        private readonly requests: EnrollmentRequestRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly classes: CourseClassRepository,
        private readonly financialCharges: SchoolFinancialChargeRepository
    ) {}

    async exec(input: ApproveEnrollmentRequestInput): Promise<ApproveEnrollmentRequestOutput> {
        // Validar e carregar solicitação
        const request = await this.validateAndLoadRequest(input.requestId);

        // Validar que pode ser aprovada
        this.validateRequestCanBeApproved(request, input.approverUserId);

        // Verificar se já existe matrícula
        await this.ensureNoExistingEnrollment(
            request.courseClassId,
            request.requestedForUserId,
            request.requestedForDependentId
        );

        // Criar matrícula
        const enrollment = this.createEnrollmentFromRequest(request);

        // Criar cobrança de taxa de matrícula se aplicável
        const pendingCharge = await this.buildEnrollmentCharge(request);

        // Salvar matrícula e cobrança
        await this.enrollments.save(enrollment);
        if (pendingCharge) {
            await this.financialCharges.save(pendingCharge);
        }

        // Aprovar solicitação
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

    private async validateAndLoadRequest(requestId: string) {
        const request = await this.requests.findById(requestId);
        if (!request) {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_REQUEST_NOT_FOUND, { requestId });
        }
        return request;
    }

    private validateRequestCanBeApproved(
        request: EnrollmentRequest,
        approverUserId: string
    ): void {
        if (request.status !== 'PENDING') {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_REQUEST_ALREADY_DECIDED, {
                requestId: request.id,
                status: request.status
            });
        }

        if (request.requestedForUserId !== approverUserId) {
            throw AppError.fromCode(ErrorCode.NOT_ALLOWED, {
                message: 'Usuário não autorizado a aprovar esta solicitação de matrícula',
                requestId: request.id,
                approverUserId,
                requestedForUserId: request.requestedForUserId
            });
        }
    }

    private async ensureNoExistingEnrollment(
        courseClassId: string,
        userId: string,
        dependentId: string | null
    ): Promise<void> {
        if (dependentId) {
            const existing = await this.enrollments.findByClassAndDependent(courseClassId, dependentId);
            if (existing) {
                throw AppError.fromCode(ErrorCode.ALREADY_ENROLLED, {
                    courseClassId,
                    dependentId
                });
            }
            return;
        }

        const existing = await this.enrollments.findByClassAndUser(courseClassId, userId);
        if (existing) {
            throw AppError.fromCode(ErrorCode.ALREADY_ENROLLED, {
                courseClassId,
                userId
            });
        }
    }

    private createEnrollmentFromRequest(request: EnrollmentRequest): Enrollment {
        const enrollmentId = Uuid();

        if (request.requestedForDependentId) {
            return Enrollment.createForDependent({
                id: enrollmentId,
                courseClassId: request.courseClassId,
                ownerUserId: request.requestedForUserId,
                dependentId: request.requestedForDependentId
            });
        }

        return Enrollment.createForUser({
            id: enrollmentId,
            courseClassId: request.courseClassId,
            ownerUserId: request.requestedForUserId,
            studentUserId: request.requestedForUserId
        });
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
