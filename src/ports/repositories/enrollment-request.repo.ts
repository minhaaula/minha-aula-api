import { EnrollmentRequest, EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';

export interface EnrollmentRequestRepository {
    findById(id: string): Promise<EnrollmentRequest | null>;
    findByCourseClassAndTarget(params: { courseClassId: string; userId: string; dependentId: string | null; }): Promise<EnrollmentRequest | null>;
    findMany(params: {
        schoolId?: string;
        courseClassId?: string;
        status?: EnrollmentRequestStatus;
        requestedForUserId?: string;
        requestedForDependentId?: string | null;
        limit?: number;
        offset?: number;
    }): Promise<EnrollmentRequest[]>;
    save(request: EnrollmentRequest): Promise<void>;
}
