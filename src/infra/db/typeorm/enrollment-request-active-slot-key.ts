import type { EnrollmentRequestStatus } from './entities/enrollment-request.orm';

export function computeEnrollmentRequestActivePendingKey(params: {
    courseClassId: string;
    status: EnrollmentRequestStatus;
    requestedForUserId: string;
    requestedForDependentId: string | null;
}): string | null {
    if (params.status !== 'PENDING') {
        return null;
    }
    const dependentPart = params.requestedForDependentId ?? '';
    return `${params.courseClassId}|${params.requestedForUserId}|${dependentPart}`;
}
