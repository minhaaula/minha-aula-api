import { In } from 'typeorm';
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
        const row = await this.repo.findOne({ where: { courseId, label, isActive: true } });
        return row ? this.toDomain(row) : null;
    }

    async findByCourseId(courseId: string): Promise<CourseClass[]> {
        const rows = await this.repo.find({
            where: { courseId, isActive: true },
            order: { createdAt: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async findByCourseIds(courseIds: string[]): Promise<CourseClass[]> {
        if (courseIds.length === 0) return [];

        const rows = await this.repo.find({
            where: {
                courseId: In(courseIds),
                isActive: true
            },
            order: { createdAt: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async countActiveBySchoolId(schoolId: string): Promise<number> {
        return await this.repo
            .createQueryBuilder('class')
            .leftJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('class.isActive = :isActive', { isActive: true })
            .getCount();
    }

    async countActiveBySchoolIds(schoolIds: string[]): Promise<Map<string, number>> {
        const ids = [...new Set(schoolIds.map((id) => id.trim()).filter(Boolean))];
        const map = new Map<string, number>();
        for (const id of ids) {
            map.set(id, 0);
        }
        if (ids.length === 0) {
            return map;
        }

        const rows = await this.repo
            .createQueryBuilder('class')
            .innerJoin('class.course', 'course')
            .select('course.schoolId', 'schoolId')
            .addSelect('COUNT(*)', 'cnt')
            .where('course.schoolId IN (:...ids)', { ids })
            .andWhere('class.isActive = :isActive', { isActive: true })
            .groupBy('course.schoolId')
            .getRawMany<{ schoolId: string; cnt: string }>();

        for (const row of rows) {
            map.set(row.schoolId, Number(row.cnt ?? 0));
        }
        return map;
    }

    async save(courseClass: CourseClass): Promise<void> {
        await this.repo.save(this.toOrm(courseClass));
    }

    async countAll(): Promise<number> {
        return await this.repo.count({ where: { isActive: true } });
    }

    private toDomain(row: CourseClassOrm): CourseClass {
        return CourseClass.create({
            id: row.id,
            courseId: row.courseId,
            label: row.label,
            schedule: row.schedule ?? [],
            capacity: row.capacity,
            monthlyPriceCents: row.monthlyPriceCents,
            classType: row.classType,
            isActive: row.isActive,
            createdAt: row.createdAt
        });
    }

    private toOrm(courseClass: CourseClass): CourseClassOrm {
        const row = new CourseClassOrm();
        row.id = courseClass.id;
        row.courseId = courseClass.courseId;
        row.label = courseClass.label;
        row.schedule = courseClass.schedule.map((entry) => ({ ...entry }));
        row.capacity = courseClass.capacity;
        row.monthlyPriceCents = courseClass.monthlyPriceCents;
        row.classType = courseClass.classType;
        row.isActive = courseClass.isActive;
        row.createdAt = courseClass.createdAt;
        return row;
    }
}


