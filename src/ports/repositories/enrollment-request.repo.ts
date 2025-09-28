import { EnrollmentRequest } from '../../domain/entities/enrollment-request';

export interface EnrollmentRequestRepository {
    findById(id: string): Promise<EnrollmentRequest | null>;
    findByCourseClassAndTarget(params: { courseClassId: string; userId: string; dependentId: string | null; }): Promise<EnrollmentRequest | null>;
    save(request: EnrollmentRequest): Promise<void>;
}
