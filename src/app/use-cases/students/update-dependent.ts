import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import { Dependent } from '../../../domain/entities/dependent';
import { AppError, ErrorCode } from '../../../shared/errors';
import { equalUuid } from '../../../shared/normalize-uuid';

export interface UpdateDependentInput {
    ownerUserId: string;
    dependentId: string;
    fullName?: string;
    birthDate?: string | null;
    relationship?: string | null;
}

export interface UpdateDependentOutput {
    id: string;
    userId: string;
    fullName: string;
    cpf: string | null;
    birthDate: Date | null;
    relationship: string | null;
    createdAt: Date;
}

export class UpdateDependent {
    constructor(
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: UpdateDependentInput): Promise<UpdateDependentOutput> {
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
            throw AppError.fromCode(ErrorCode.DEPENDENT_NOT_FOUND, { dependentId });
        }

        // Validar se o nome não está duplicado (exceto para o próprio dependente)
        const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : dependent.fullName;
        if (!fullName) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Nome completo é obrigatório'
            });
        }

        if (fullName !== dependent.fullName) {
            const existing = await this.dependents.findByUserAndFullName(ownerUserId, fullName);
            if (existing && existing.id !== dependentId) {
                throw AppError.fromCode(ErrorCode.DEPENDENT_ALREADY_EXISTS, {
                    userId: ownerUserId,
                    fullName
                });
            }
        }

        // Validar data de nascimento
        const birthDate = input.birthDate !== undefined
            ? (input.birthDate ? new Date(input.birthDate) : null)
            : dependent.birthDate;
        
        if (birthDate && Number.isNaN(birthDate.getTime())) {
            throw AppError.fromCode(ErrorCode.INVALID_BIRTH_DATE, { birthDate: input.birthDate });
        }

        const relationship = input.relationship !== undefined
            ? (input.relationship?.trim() || null)
            : dependent.relationship;

        // Criar dependente atualizado (mantendo CPF original)
        const updated = Dependent.create({
            id: dependent.id,
            userId: dependent.userId,
            fullName,
            cpf: dependent.cpf, // CPF não pode ser alterado
            birthDate,
            relationship,
            createdAt: dependent.createdAt,
            deletedAt: dependent.deletedAt,
            photoStorageKey: dependent.photoStorageKey
        });

        await this.dependents.save(updated);

        return {
            id: updated.id,
            userId: updated.userId,
            fullName: updated.fullName,
            cpf: updated.cpf,
            birthDate: updated.birthDate,
            relationship: updated.relationship,
            createdAt: updated.createdAt
        };
    }
}

