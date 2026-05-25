import { EnrollmentRequest } from '../../../domain/entities/enrollment-request';
import { EnrollmentRequestRepository } from '../../../ports/repositories/enrollment-request.repo';

export class GetEnrollmentRequest {
    constructor(private readonly requests: EnrollmentRequestRepository) {}

    async exec(params: { requestId: string }): Promise<EnrollmentRequest | null> {
        const requestId = params.requestId.trim();
        if (!requestId) {
            throw new Error('Invalid enrollment request identifier');
        }
        return this.requests.findById(requestId);
    }
}
