import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { AppError, ErrorCode } from '../../shared/errors';
import { EnrollmentRequest } from '../../domain/entities/enrollment-request';

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
        private readonly requests: EnrollmentRequestRepository
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

        return {
            requestId: request.id,
            status: request.status,
            rejectedAt: request.decidedAt!,
            rejectedByUserId: request.decidedByUserId!,
            notes: request.notes
        };
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

