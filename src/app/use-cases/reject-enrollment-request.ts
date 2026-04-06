import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { OutboxRepository } from '../../ports/repositories/outbox.repo';
import { AppError, ErrorCode } from '../../shared/errors';
import { EnrollmentRequest } from '../../domain/entities/enrollment-request';
import type { NotifyStudentUser } from './notify-student-user';

export interface RejectEnrollmentRequestInput {
    requestId: string;
    rejectorUserId: string;
    notes?: string | null;
}

export interface RejectEnrollmentRequestOutput {
    requestId: string;
    status: string;
    rejectedAt: Date;
    rejectedByUserId: string;
    notes: string | null;
}

export class RejectEnrollmentRequest {
    constructor(
        private readonly requests: EnrollmentRequestRepository,
        private readonly users?: UserRepository,
        private readonly schools?: SchoolRepository,
        private readonly courses?: CourseRepository,
        private readonly classes?: CourseClassRepository,
        private readonly dependents?: DependentRepository,
        private readonly outbox?: OutboxRepository,
        private readonly notifyStudent?: NotifyStudentUser,
        private readonly frontendBaseUrl?: string
    ) {}

    async exec(input: RejectEnrollmentRequestInput): Promise<RejectEnrollmentRequestOutput> {
        // Validar e carregar solicitação
        const request = await this.validateAndLoadRequest(input.requestId);

        // Validar que pode ser rejeitada
        this.validateRequestCanBeRejected(request, input.rejectorUserId);

        // Rejeitar solicitação
        request.reject({
            decidedByUserId: input.rejectorUserId,
            notes: input.notes ?? null
        });

        await this.requests.save(request);

        if (
            this.notifyStudent &&
            this.outbox &&
            this.users &&
            this.schools &&
            this.courses &&
            this.classes
        ) {
            this.notifyAfterReject(request, input.notes ?? null).catch(() => {});
        }

        return {
            requestId: request.id,
            status: request.status,
            rejectedAt: request.decidedAt!,
            rejectedByUserId: request.decidedByUserId!,
            notes: request.notes
        };
    }

    private async notifyAfterReject(request: EnrollmentRequest, notes: string | null): Promise<void> {
        if (!this.notifyStudent || !this.outbox || !this.users || !this.schools || !this.courses || !this.classes) {
            return;
        }

        const school = await this.schools.findById(request.schoolId);
        const courseClass = await this.classes.findById(request.courseClassId);
        if (!courseClass) return;
        const course = await this.courses.findById(courseClass.courseId);
        const owner = await this.users.findById(request.requestedForUserId);
        if (!school || !course || !owner) return;

        let studentName = owner.fullName;
        if (request.requestedForDependentId && this.dependents) {
            const dep = await this.dependents.findById(request.requestedForDependentId);
            if (dep) studentName = dep.fullName;
        }

        const loginUrl = this.frontendBaseUrl ? `${this.frontendBaseUrl}/login` : undefined;

        await this.outbox.enqueue({
            type: 'send_enrollment_request_rejected_email',
            aggregateId: request.id,
            payload: {
                to: owner.email.value,
                studentName,
                schoolName: school.name,
                courseName: course.name,
                className: courseClass.label,
                loginUrl,
                notes
            }
        });

        await this.notifyStudent.exec({
            userId: request.requestedForUserId,
            schoolId: request.schoolId,
            title: 'Pedido de matrícula recusado',
            message: `Você recusou o pedido em ${course.name} (${school.name}).`,
            kind: 'ENROLLMENT_REQUEST_REJECTED',
            sendPush: false,
            extraMetadata: {
                enrollmentRequestId: request.id,
                courseClassId: request.courseClassId
            }
        });
    }

    private async validateAndLoadRequest(requestId: string): Promise<EnrollmentRequest> {
        const request = await this.requests.findById(requestId);
        if (!request) {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_REQUEST_NOT_FOUND, { requestId });
        }
        return request;
    }

    private validateRequestCanBeRejected(
        request: EnrollmentRequest,
        rejectorUserId: string
    ): void {
        if (request.status !== 'PENDING') {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_REQUEST_ALREADY_DECIDED, {
                requestId: request.id,
                status: request.status
            });
        }

        // Apenas o próprio estudante pode rejeitar sua solicitação
        if (request.requestedForUserId !== rejectorUserId) {
            throw AppError.fromCode(ErrorCode.NOT_ALLOWED, {
                message: 'Usuário não autorizado a rejeitar esta solicitação de matrícula',
                requestId: request.id,
                rejectorUserId,
                requestedForUserId: request.requestedForUserId
            });
        }
    }
}

