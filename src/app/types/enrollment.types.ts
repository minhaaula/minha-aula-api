/**
 * Tipos relacionados a solicitações de matrícula
 */

export interface CreateEnrollmentRequestInput {
    schoolId: string;
    courseClassId: string;
    requestedForUserId: string;
    requestedForDependentId?: string | null;
    notes?: string | null;
    discount?: number | null;
    enrollmentFeeAmount?: number | null;
    enrollmentFeeDueDate?: string | null;
    firstMonthlyPaymentDate: string;
}

export interface ApproveEnrollmentRequestInput {
    requestId: string;
    approverUserId: string;
    notes?: string | null;
}

export interface ApproveEnrollmentRequestOutput {
    requestId: string;
    enrollmentId: string;
    status: string;
    enrollmentFeeChargeId: string | null;
    enrollmentFeeBoletoGenerated?: boolean;
    firstTuitionChargeId?: string | null;
}

export interface ListEnrollmentRequestsInput {
    schoolId: string;
    courseClassId?: string | null;
    courseId?: string | null;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | null;
    requestedForUserId?: string | null;
    requestedForDependentId?: string | null;
    studentDocument?: string | null;
    limit?: number | null;
    offset?: number | null;
}

export interface GetEnrollmentRequestInput {
    requestId: string;
}

export interface IssueEnrollmentFeeBoletoInput {
    chargeId: string;
    requester: {
        id: string;
        persona: string;
        schoolId: string | null;
    };
}

export interface IssueEnrollmentFeeBoletoOutput {
    chargeId: string;
    paymentProviderRef: string;
    boletoUrl: string | null;
    digitableLine: string | null;
    barcode: string | null;
    dueDate: Date;
    status: string;
}

export interface EnrollStudentInput {
    schoolId: string;
    courseId: string;
    classId: string;
    studentUserId: string;
    dependentId?: string | null;
}

export interface EnrollStudentOutput {
    id: string;
    courseClassId: string;
    ownerUserId: string;
    studentType: 'USER' | 'DEPENDENT';
    studentUserId: string | null;
    dependentId: string | null;
    status: string;
    enrolledAt: Date;
    updatedAt: Date;
}
