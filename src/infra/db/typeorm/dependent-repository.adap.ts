import { AppDataSource } from './datasource';
import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import { Dependent } from '../../../domain/entities/dependent';
import { DependentOrm } from './entities/dependent.orm';
import { In } from 'typeorm';

export class DependentRepositoryAdapter implements DependentRepository {
    private readonly repo = AppDataSource.getRepository(DependentOrm);

    async findById(id: string): Promise<Dependent | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByUserAndFullName(userId: string, fullName: string): Promise<Dependent | null> {
        const cleaned = fullName.trim();
        if (!cleaned) return null;
        const row = await this.repo.findOne({ where: { userId, fullName: cleaned } });
        return row ? this.toDomain(row) : null;
    }

    async findByUserIds(userIds: string[]): Promise<Dependent[]> {
        if (!userIds.length) return [];
        const rows = await this.repo.find({ where: { userId: In(userIds) } });
        return rows.map((row) => this.toDomain(row));
    }

    async save(dependent: Dependent): Promise<void> {
        await this.repo.save(this.toOrm(dependent));
    }

    private toDomain(row: DependentOrm): Dependent {
        return Dependent.create({
            id: row.id,
            userId: row.userId,
            fullName: row.fullName,
            birthDate: row.birthDate ? new Date(row.birthDate) : null,
            relationship: row.relationship,
            createdAt: new Date(row.createdAt)
        });
    }

    private toOrm(dependent: Dependent): DependentOrm {
        const row = new DependentOrm();
        row.id = dependent.id;
        row.userId = dependent.userId;
        row.fullName = dependent.fullName;
        row.birthDate = dependent.birthDate;
        row.relationship = dependent.relationship;
        row.createdAt = dependent.createdAt;
        return row;
    }
}
