import type { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import type { EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';

export type ListAdminEnrollmentRequestsInput = {
    studentName?: string | null;
    studentCpf?: string | null;
    schoolName?: string | null;
    status?: EnrollmentRequestStatus | null;
    limit?: number;
    offset?: number;
};

export type ListAdminEnrollmentRequestsOutput = {
    requests: Array<{
        id: string;
        status: string;
        schoolId: string;
        schoolName: string;
        courseClassId: string;
        courseLabel: string | null;
        courseClassLabel: string | null;
        requestedForUserId: string;
        requestedForDependentId: string | null;
        studentName: string;
        dependentName: string | null;
        decidedAt: Date | null;
        decidedByUserId: string | null;
        notes: string | null;
        enrollmentFeeAmount: number | null;
        enrollmentFeeDueDate: string | null;
        firstMonthlyPaymentDate: string;
        enrollmentId: string | null;
        createdAt: Date;
    }>;
    pagination: {
        total: number;
        limit: number;
        offset: number;
        totalPage: number;
        currentPage: number;
        hasMore: boolean;
    };
};

export class ListAdminEnrollmentRequests {
    constructor(private readonly enrollmentRequests: EnrollmentRequestRepository) {}

    async exec(input: ListAdminEnrollmentRequestsInput): Promise<ListAdminEnrollmentRequestsOutput> {
        const findManyForAdmin = this.enrollmentRequests.findManyForAdmin;
        if (!findManyForAdmin) {
            return {
                requests: [],
                pagination: {
                    total: 0,
                    limit: 50,
                    offset: 0,
                    totalPage: 1,
                    currentPage: 1,
                    hasMore: false
                }
            };
        }

        const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
        const offset = Math.max(0, input.offset ?? 0);

        const { items, total } = await findManyForAdmin.call(this.enrollmentRequests, {
            studentName: input.studentName ?? null,
            studentCpf: input.studentCpf ?? null,
            schoolName: input.schoolName ?? null,
            status: input.status ?? null,
            limit,
            offset
        });

        const requests = items.map((item) => ({
            id: item.request.id,
            status: item.request.status,
            schoolId: item.request.schoolId,
            schoolName: item.schoolName,
            courseClassId: item.request.courseClassId,
            courseLabel: item.courseLabel,
            courseClassLabel: item.courseClassLabel,
            requestedForUserId: item.request.requestedForUserId,
            requestedForDependentId: item.request.requestedForDependentId,
            studentName: item.studentName,
            dependentName: item.dependentName,
            decidedAt: item.request.decidedAt,
            decidedByUserId: item.request.decidedByUserId,
            notes: item.request.notes,
            enrollmentFeeAmount: item.request.enrollmentFeeCents !== null ? item.request.enrollmentFeeCents / 100 : null,
            enrollmentFeeDueDate: item.request.enrollmentFeeDueDate
                ? item.request.enrollmentFeeDueDate.toISOString().slice(0, 10)
                : null,
            firstMonthlyPaymentDate: item.request.firstMonthlyPaymentDate.toISOString().slice(0, 10),
            enrollmentId: item.request.enrollmentId,
            createdAt: item.request.createdAt
        }));

        return {
            requests,
            pagination: {
                total,
                limit,
                offset,
                totalPage: Math.ceil(total / limit) || 1,
                currentPage: Math.floor(offset / limit) + 1,
                hasMore: offset + limit < total
            }
        };
    }
}
