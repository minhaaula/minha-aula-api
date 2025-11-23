import { EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';
import {
    EnrollmentRequestRepository,
    EnrollmentRequestWithDetails
} from '../../ports/repositories/enrollment-request.repo';

export interface MyEnrollmentRequest {
    id: string;
    status: EnrollmentRequestStatus;
    schoolId: string;
    courseClassId: string;
    requestedForUserId: string;
    requestedForDependentId: string | null;
    decidedAt: Date | null;
    decidedByUserId: string | null;
    notes: string | null;
    discount: number | null;
    enrollmentFeeAmount: number | null;
    enrollmentFeeDueDate: Date | null;
    firstMonthlyPaymentDate: Date;
    enrollmentId: string | null;
    createdAt: Date;
    courseLabel: string | null;
    courseClassLabel: string | null;
    studentName: string | null;
    dependentName: string | null;
}

export class ListMyEnrollmentRequests {
    constructor(private readonly requests: EnrollmentRequestRepository) {}

    async exec(params: {
        userId: string;
        status?: EnrollmentRequestStatus;
        limit?: number;
        offset?: number;
    }): Promise<{ requests: MyEnrollmentRequest[] }> {
        const userId = params.userId?.trim();
        if (!userId) {
            return { requests: [] };
        }

        const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
        const offset = Math.max(0, params.offset ?? 0);

        const allRequests = await this.requests.findMany({
            requestedForUserId: userId,
            status: params.status,
            limit,
            offset
        });

        const requests: MyEnrollmentRequest[] = allRequests.map((req) => ({
            id: req.request.id,
            status: req.request.status,
            schoolId: req.request.schoolId,
            courseClassId: req.request.courseClassId,
            requestedForUserId: req.request.requestedForUserId,
            requestedForDependentId: req.request.requestedForDependentId,
            decidedAt: req.request.decidedAt,
            decidedByUserId: req.request.decidedByUserId,
            notes: req.request.notes,
            discount: req.request.discountCents !== null ? req.request.discountCents / 100 : null,
            enrollmentFeeAmount: req.request.enrollmentFeeCents !== null ? req.request.enrollmentFeeCents / 100 : null,
            enrollmentFeeDueDate: req.request.enrollmentFeeDueDate,
            firstMonthlyPaymentDate: req.request.firstMonthlyPaymentDate,
            enrollmentId: req.request.enrollmentId,
            createdAt: req.request.createdAt,
            courseLabel: req.courseLabel,
            courseClassLabel: req.courseClassLabel,
            studentName: req.studentName,
            dependentName: req.dependentName
        }));

        return { requests };
    }
}

