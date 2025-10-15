import { EnrollmentRequest, EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';
import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';

export class ListEnrollmentRequests {
    constructor(private readonly requests: EnrollmentRequestRepository) {}

    async exec(params: {
        schoolId: string;
        courseClassId?: string;
        status?: EnrollmentRequestStatus;
        requestedForUserId?: string;
        requestedForDependentId?: string | null;
        limit?: number;
        offset?: number;
    }): Promise<EnrollmentRequest[]> {
        const schoolId = params.schoolId.trim();
        if (!schoolId) {
            throw new Error('Invalid enrollment request filters');
        }

        const courseClassId = params.courseClassId?.trim();
        const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
        const offset = Math.max(0, params.offset ?? 0);

        const requestedForUserId = params.requestedForUserId?.trim();
        const requestedForDependentId = params.requestedForDependentId === undefined
            ? undefined
            : params.requestedForDependentId === null
                ? null
                : params.requestedForDependentId.trim();

        return this.requests.findMany({
            schoolId,
            courseClassId,
            status: params.status,
            requestedForUserId,
            requestedForDependentId,
            limit,
            offset
        });
    }
}
