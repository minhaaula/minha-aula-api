import { AppDataSource } from './datasource';
import { ClassSessionRepository } from '../../../ports/repositories/class-session.repo';
import { ClassSession } from '../../../domain/entities/class-session';
import { ClassSessionOrm } from './entities/class-session.orm';

export class ClassSessionRepositoryAdapter implements ClassSessionRepository {
    private readonly repo = AppDataSource.getRepository(ClassSessionOrm);

    async findById(id: string): Promise<ClassSession | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByClassAndInterval(params: { courseClassId: string; from: Date; to: Date }): Promise<ClassSession[]> {
        const { courseClassId } = params;
        const from = new Date(params.from);
        const to = new Date(params.to);
        const rows = await this.repo.createQueryBuilder('session')
            .where('session.courseClassId = :courseClassId', { courseClassId })
            .andWhere('session.status != :cancelled', { cancelled: 'CANCELLED' })
            .andWhere('session.startsAt < :end', { end: to })
            .andWhere('session.endsAt > :start', { start: from })
            .orderBy('session.startsAt', 'ASC')
            .getMany();
        return rows.map((row) => this.toDomain(row));
    }

    async findBySchoolAndInterval(params: { schoolId: string; from: Date; to: Date; courseClassId?: string | null; }): Promise<ClassSession[]> {
        const { schoolId } = params;
        const from = new Date(params.from);
        const to = new Date(params.to);
        const qb = this.repo.createQueryBuilder('session')
            .where('session.schoolId = :schoolId', { schoolId })
            .andWhere('session.status != :cancelled', { cancelled: 'CANCELLED' })
            .andWhere('session.startsAt < :to', { to })
            .andWhere('session.endsAt > :from', { from })
            .orderBy('session.startsAt', 'ASC');

        if (params.courseClassId) {
            qb.andWhere('session.courseClassId = :courseClassId', { courseClassId: params.courseClassId });
        }

        const rows = await qb.getMany();
        return rows.map((row) => this.toDomain(row));
    }

    async save(session: ClassSession): Promise<void> {
        const row = this.toOrm(session);
        await this.repo.save(row);
    }

    async delete(id: string): Promise<void> {
        await this.repo.delete({ id });
    }

    private toDomain(row: ClassSessionOrm): ClassSession {
        return ClassSession.create({
            id: row.id,
            schoolId: row.schoolId,
            courseClassId: row.courseClassId,
            startsAt: row.startsAt,
            endsAt: row.endsAt,
            status: row.status === 'CANCELLED' ? 'CANCELLED' : 'SCHEDULED',
            location: row.location,
            notes: row.notes,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        });
    }

    private toOrm(session: ClassSession): ClassSessionOrm {
        const row = new ClassSessionOrm();
        row.id = session.id;
        row.schoolId = session.schoolId;
        row.courseClassId = session.courseClassId;
        row.startsAt = session.startsAt;
        row.endsAt = session.endsAt;
        row.status = session.status;
        row.location = session.location;
        row.notes = session.notes;
        row.createdAt = session.createdAt;
        row.updatedAt = session.updatedAt;
        return row;
    }
}
