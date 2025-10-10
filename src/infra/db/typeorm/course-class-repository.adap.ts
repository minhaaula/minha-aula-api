import { AppDataSource } from './datasource';
import { CourseClassRepository } from '../../../ports/repositories/course-class.repo';
import { CourseClass } from '../../../domain/entities/course-class';
import { CourseClassOrm } from './entities/course-class.orm';

export class CourseClassRepositoryAdapter implements CourseClassRepository {
    private readonly repo = AppDataSource.getRepository(CourseClassOrm);

    async findById(id: string): Promise<CourseClass | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByCourseAndLabel(courseId: string, label: string): Promise<CourseClass | null> {
        const row = await this.repo.findOne({ where: { courseId, label } });
        return row ? this.toDomain(row) : null;
    }

    async findByCourseId(courseId: string): Promise<CourseClass[]> {
        const rows = await this.repo.find({
            where: { courseId },
            order: { createdAt: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async save(courseClass: CourseClass): Promise<void> {
        await this.repo.save(this.toOrm(courseClass));
    }

    private toDomain(row: CourseClassOrm): CourseClass {
        return CourseClass.create({
            id: row.id,
            courseId: row.courseId,
            label: row.label,
            shift: row.shift,
            capacity: row.capacity,
            startsAt: row.startsAt,
            endsAt: row.endsAt,
            createdAt: row.createdAt
        });
    }

    private toOrm(courseClass: CourseClass): CourseClassOrm {
        const row = new CourseClassOrm();
        row.id = courseClass.id;
        row.courseId = courseClass.courseId;
        row.label = courseClass.label;
        row.shift = courseClass.shift;
        row.capacity = courseClass.capacity;
        row.startsAt = courseClass.startsAt;
        row.endsAt = courseClass.endsAt;
        row.createdAt = courseClass.createdAt;
        return row;
    }
}
