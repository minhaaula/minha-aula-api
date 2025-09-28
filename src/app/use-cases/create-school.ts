import { SchoolRepository } from '../../ports/repositories/school.repo';
import { School } from '../../domain/entities/school';
import { Uuid } from '../../shared/uuid';

export class CreateSchool {
    constructor(private readonly schools: SchoolRepository) {}

    async exec(input: { name: string; }): Promise<{ id: string; name: string; createdAt: Date; }> {
        const school = School.create({ id: Uuid(), name: input.name });
        await this.schools.save(school);
        return { id: school.id, name: school.name, createdAt: school.createdAt };
    }
}
