import { EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';
import {
    EnrollmentRequestRepository,
    EnrollmentRequestWithDetails
} from '../../ports/repositories/enrollment-request.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';

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
    constructor(
        private readonly requests: EnrollmentRequestRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(params: {
        userId: string;
        status?: EnrollmentRequestStatus | null;
        limit?: number | null;
        offset?: number | null;
    }): Promise<{ requests: MyEnrollmentRequest[] }> {
        const userId = params.userId?.trim();
        if (!userId) {
            return { requests: [] };
        }
        const status = params.status ?? null;

        // Buscar dependentes do usuário
        const userDependents = await this.dependents.findByUserIds([userId]);
        const dependentIds = userDependents.map((dep) => dep.id);

        // Buscar pedidos de matrícula do usuário (sem dependente)
        const userRequests = await this.requests.findMany({
            requestedForUserId: userId,
            requestedForDependentId: null,
            status: status ?? undefined
        });

        // Buscar pedidos de matrícula dos dependentes
        const dependentRequestsPromises = dependentIds.map((dependentId) =>
            this.requests.findMany({
                requestedForUserId: userId,
                requestedForDependentId: dependentId,
                status: status ?? undefined
            })
        );

        const dependentRequestsArrays = await Promise.all(dependentRequestsPromises);
        const allDependentRequests = dependentRequestsArrays.flat();

        // Combinar todos os pedidos
        const allRequests: EnrollmentRequestWithDetails[] = [
            ...userRequests,
            ...allDependentRequests
        ];

        // Ordenar por data de criação (mais recentes primeiro)
        allRequests.sort((a, b) => {
            const dateA = a.request.createdAt.getTime();
            const dateB = b.request.createdAt.getTime();
            return dateB - dateA;
        });

        const mapped: MyEnrollmentRequest[] = allRequests.map((req) => ({
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

        const limit = params.limit ?? null;
        const offset = params.offset ?? null;
        const safeOffset = typeof offset === 'number' && offset > 0 ? offset : 0;
        const safeLimit = typeof limit === 'number' && limit > 0 ? Math.min(limit, 100) : null;
        const paged = safeLimit === null ? mapped.slice(safeOffset) : mapped.slice(safeOffset, safeOffset + safeLimit);

        return { requests: paged };
    }
}

