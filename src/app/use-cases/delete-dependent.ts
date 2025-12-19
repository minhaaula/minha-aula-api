import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';
import { AppError, ErrorCode } from '../../shared/errors';
import { equalUuid } from '../../shared/normalize-uuid';

export class DeleteDependent {
    constructor(
        private readonly dependents: DependentRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly enrollmentRequests: EnrollmentRequestRepository
    ) {}

    async exec(input: { ownerUserId: string; dependentId: string }): Promise<void> {
        const ownerUserId = input.ownerUserId.trim();
        const dependentId = input.dependentId.trim();

        if (!ownerUserId || !dependentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS);
        }

        const dependent = await this.dependents.findById(dependentId);
        if (!dependent) {
            throw AppError.fromCode(ErrorCode.DEPENDENT_NOT_FOUND, { dependentId });
        }

        if (!equalUuid(dependent.userId, ownerUserId)) {
            throw AppError.fromCode(ErrorCode.FORBIDDEN, { 
                message: 'Dependente não pertence ao usuário' 
            });
        }

        if (dependent.deletedAt) {
            return; // Já está deletado
        }

        // Verificar se há enrollments ativos
        const activeEnrollments = await this.enrollments.findActiveByDependentId(dependentId);
        if (activeEnrollments.length > 0) {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                message: 'Não é possível excluir dependente com matrículas ativas em escolas'
            });
        }

        // Verificar se há enrollment requests pendentes
        const pendingStatus: EnrollmentRequestStatus = 'PENDING';
        const pendingRequests = await this.enrollmentRequests.findMany({
            requestedForDependentId: dependentId,
            status: pendingStatus,
            limit: 1
        });

        if (pendingRequests.length > 0) {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                message: 'Não é possível excluir dependente com solicitações de matrícula pendentes'
            });
        }

        dependent.markAsDeleted();
        await this.dependents.save(dependent);
    }
}

