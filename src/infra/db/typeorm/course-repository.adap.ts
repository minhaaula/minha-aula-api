import { AppDataSource } from './datasource';
import { CourseRepository } from '../../../ports/repositories/course.repo';
import { Course } from '../../../domain/entities/course';
import { CourseOrm } from './entities/course.orm';

export class CourseRepositoryAdapter implements CourseRepository {
    private readonly repo = AppDataSource.getRepository(CourseOrm);

    async findById(id: string): Promise<Course | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findBySchoolAndName(schoolId: string, name: string): Promise<Course | null> {
        const row = await this.repo.findOne({ where: { schoolId, name } });
        return row ? this.toDomain(row) : null;
    }

    async save(course: Course): Promise<void> {
        await this.repo.save(this.toOrm(course));
    }

    private toDomain(row: CourseOrm): Course {
        return Course.create({
            id: row.id,
            schoolId: row.schoolId,
            name: row.name,
            description: row.description,
            isActive: row.isActive,
            createdAt: row.createdAt
        });
    }

    private toOrm(course: Course): CourseOrm {
        const row = new CourseOrm();
        row.id = course.id;
        row.schoolId = course.schoolId;
        row.name = course.name;
        row.description = course.description;
        row.isActive = course.isActive;
        row.createdAt = course.createdAt;
        return row;
    }
}
