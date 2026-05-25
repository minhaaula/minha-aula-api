import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import { UserRepository } from '../../../ports/repositories/user.repo';
import { Dependent } from '../../../domain/entities/dependent';
import { Uuid } from '../../../shared/uuid';
import { AppError, ErrorCode } from '../../../shared/errors';
import type { AddDependentInput, AddDependentOutput } from '../../types/dependent.types';

export class AddDependent {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: AddDependentInput): Promise<AddDependentOutput> {
        const owner = await this.users.findById(input.ownerUserId);
        if (!owner) throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId: input.ownerUserId });

        const existing = await this.dependents.findByUserAndFullName(owner.id, input.fullName);
        if (existing) throw AppError.fromCode(ErrorCode.DEPENDENT_ALREADY_EXISTS, {
            userId: owner.id,
            fullName: input.fullName
        });

        const normalizedCpf = this.normalizeCpf(input.cpf);
        if (normalizedCpf) {
            // Verificar se CPF já está cadastrado como usuário
            const existingUser = await this.users.findByCpf(normalizedCpf);
            if (existingUser) {
                throw AppError.fromCode(ErrorCode.CPF_ALREADY_REGISTERED, { cpf: normalizedCpf });
            }
            
            // Verificar se CPF já está cadastrado como dependente
            const existingCpf = await this.dependents.findByCpf(normalizedCpf);
            if (existingCpf) {
                throw AppError.fromCode(ErrorCode.CPF_ALREADY_REGISTERED, { cpf: normalizedCpf });
            }
        }

        const birthDate = input.birthDate ? new Date(input.birthDate) : null;
        if (birthDate && Number.isNaN(birthDate.getTime())) {
            throw AppError.fromCode(ErrorCode.INVALID_BIRTH_DATE, { birthDate: input.birthDate });
        }

        const dependent = Dependent.create({
            id: Uuid(),
            userId: owner.id,
            fullName: input.fullName,
            cpf: normalizedCpf,
            birthDate,
            relationship: input.relationship ?? null,
            gender: input.gender ?? null
        });

        await this.dependents.save(dependent);

        return {
            id: dependent.id,
            userId: dependent.userId,
            fullName: dependent.fullName,
            cpf: dependent.cpf,
            birthDate: dependent.birthDate,
            relationship: dependent.relationship,
            gender: dependent.gender,
            createdAt: dependent.createdAt
        };
    }

    private normalizeCpf(value?: string | null): string | null {
        if (value === undefined || value === null || value === '') {
            return null;
        }
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) {
            throw AppError.fromCode(ErrorCode.INVALID_CPF, { cpf: value });
        }
        return digits;
    }
}
