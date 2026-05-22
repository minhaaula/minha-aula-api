import { AppDataSource } from './datasource';
import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import { Dependent } from '../../../domain/entities/dependent';
import { DependentOrm } from './entities/dependent.orm';
import { In, IsNull, QueryFailedError } from 'typeorm';
import { AppError, ErrorCode } from '../../../shared/errors';

export class DependentRepositoryAdapter implements DependentRepository {
    private readonly repo = AppDataSource.getRepository(DependentOrm);

    async findById(id: string): Promise<Dependent | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByCpf(cpf: string): Promise<Dependent | null> {
        const normalized = cpf.replace(/\D/g, '');
        if (normalized.length !== 11) return null;
        const row = await this.repo.findOne({ 
            where: { cpf: normalized, deletedAt: IsNull() } 
        });
        return row ? this.toDomain(row) : null;
    }

    async findByUserAndFullName(userId: string, fullName: string): Promise<Dependent | null> {
        const cleaned = fullName.trim();
        if (!cleaned) return null;
        const row = await this.repo.findOne({ 
            where: { userId, fullName: cleaned, deletedAt: IsNull() } 
        });
        return row ? this.toDomain(row) : null;
    }

    async findByUserIds(userIds: string[]): Promise<Dependent[]> {
        if (!userIds.length) return [];
        const rows = await this.repo.find({ 
            where: { userId: In(userIds), deletedAt: IsNull() } 
        });
        return rows.map((row) => this.toDomain(row));
    }

    async save(dependent: Dependent): Promise<void> {
        try {
            await this.repo.save(this.toOrm(dependent));
        } catch (error) {
            // Tratar erro de duplicação de CPF
            if (error instanceof QueryFailedError) {
                const errorMessage = error.message || '';
                if (errorMessage.includes('idx_dependents_cpf') || errorMessage.includes('Duplicate entry')) {
                    const cpf = dependent.cpf;
                    if (cpf) {
                        throw AppError.fromCode(ErrorCode.CPF_ALREADY_REGISTERED, { cpf });
                    }
                }
            }
            throw error;
        }
    }

    private toDomain(row: DependentOrm): Dependent {
        return Dependent.create({
            id: row.id,
            userId: row.userId,
            fullName: row.fullName,
            cpf: row.cpf,
            birthDate: row.birthDate ? new Date(row.birthDate) : null,
            relationship: row.relationship,
            createdAt: new Date(row.createdAt),
            deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
            photoStorageKey: row.photoUrl ?? null,
            gender: row.gender ?? null
        });
    }

    private toOrm(dependent: Dependent): DependentOrm {
        const row = new DependentOrm();
        row.id = dependent.id;
        row.userId = dependent.userId;
        row.fullName = dependent.fullName;
        row.cpf = dependent.cpf;
        row.birthDate = dependent.birthDate;
        row.relationship = dependent.relationship;
        row.createdAt = dependent.createdAt;
        row.deletedAt = dependent.deletedAt;
        row.photoUrl = dependent.photoStorageKey;
        row.gender = dependent.gender;
        return row;
    }
}


