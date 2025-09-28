import { AppDataSource } from './datasource';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { School } from '../../../domain/entities/school';
import { SchoolOrm } from './entities/school.orm';

export class SchoolRepositoryAdapter implements SchoolRepository {
    private readonly repo = AppDataSource.getRepository(SchoolOrm);

    async findById(id: string): Promise<School | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async save(school: School): Promise<void> {
        await this.repo.save(this.toOrm(school));
    }

    private toDomain(row: SchoolOrm): School {
        return School.create({ id: row.id, name: row.name, createdAt: row.createdAt });
    }

    private toOrm(school: School): SchoolOrm {
        const row = new SchoolOrm();
        row.id = school.id;
        row.name = school.name;
        row.createdAt = school.createdAt;
        return row;
    }
}
