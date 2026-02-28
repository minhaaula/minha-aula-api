import { EnrollmentRequest, EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';

export interface EnrollmentRequestWithDetails {
    request: EnrollmentRequest;
    courseClassLabel: string | null;
    courseLabel: string | null;
    studentName: string;
    dependentName: string | null;
}

export type AdminEnrollmentRequestItem = EnrollmentRequestWithDetails & { schoolName: string };

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
    /** Lista pedidos de matrícula de todas as escolas (admin). Filtros: nome aluno, cpf aluno, nome escola. */
    findManyForAdmin?(params: {
        studentName?: string | null;
        studentCpf?: string | null;
        schoolName?: string | null;
        status?: EnrollmentRequestStatus | null;
        limit?: number;
        offset?: number;
    }): Promise<{ items: AdminEnrollmentRequestItem[]; total: number }>;
    countPendingBySchoolId?(schoolId: string): Promise<number>;
    save(request: EnrollmentRequest): Promise<void>;
}
