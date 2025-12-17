import { EnrollmentRequest, EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';

export interface EnrollmentRequestWithDetails {
    request: EnrollmentRequest;
    courseClassLabel: string | null;
    courseLabel: string | null;
    studentName: string;
    dependentName: string | null;
}

export interface EnrollmentRequestRepository {
    findById(id: string): Promise<EnrollmentRequest | null>;
    findByCourseClassAndTarget(params: { courseClassId: string; userId: string; dependentId: string | null; }): Promise<EnrollmentRequest | null>;
    findMany(params: {
        schoolId?: string;
        courseClassId?: string;
        courseId?: string;
        status?: EnrollmentRequestStatus;
        requestedForUserId?: string;
        requestedForDependentId?: string | null;
        studentDocument?: string;
        limit?: number;
        offset?: number;
    }): Promise<EnrollmentRequestWithDetails[]>;
    countPendingBySchoolId?(schoolId: string): Promise<number>;
    save(request: EnrollmentRequest): Promise<void>;
}
