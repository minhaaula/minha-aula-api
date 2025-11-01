import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { Dependent } from '../../domain/entities/dependent';
import { Uuid } from '../../shared/uuid';

export class AddDependent {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: {
        ownerUserId: string;
        fullName: string;
        cpf?: string | null;
        birthDate?: string | null;
        relationship?: string | null;
    }): Promise<{
        id: string;
        userId: string;
        fullName: string;
        cpf: string | null;
        birthDate: Date | null;
        relationship: string | null;
        createdAt: Date;
    }> {
        const owner = await this.users.findById(input.ownerUserId);
        if (!owner) throw new Error('User not found');

        const existing = await this.dependents.findByUserAndFullName(owner.id, input.fullName);
        if (existing) throw new Error('Dependent with this name already exists for the user');

        const normalizedCpf = this.normalizeCpf(input.cpf);
        if (normalizedCpf) {
            const existingCpf = await this.dependents.findByCpf(normalizedCpf);
            if (existingCpf) {
                throw new Error('Dependent with this CPF already exists');
            }
        }

        const birthDate = input.birthDate ? new Date(input.birthDate) : null;
        if (birthDate && Number.isNaN(birthDate.getTime())) throw new Error('Invalid dependent birth date');

        const dependent = Dependent.create({
            id: Uuid(),
            userId: owner.id,
            fullName: input.fullName,
            cpf: normalizedCpf,
            birthDate,
            relationship: input.relationship ?? null
        });

        await this.dependents.save(dependent);

        return {
            id: dependent.id,
            userId: dependent.userId,
            fullName: dependent.fullName,
            cpf: dependent.cpf,
            birthDate: dependent.birthDate,
            relationship: dependent.relationship,
            createdAt: dependent.createdAt
        };
    }

    private normalizeCpf(value?: string | null): string | null {
        if (value === undefined || value === null || value === '') {
            return null;
        }
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) {
            throw new Error('Invalid dependent CPF');
        }
        return digits;
    }
}
