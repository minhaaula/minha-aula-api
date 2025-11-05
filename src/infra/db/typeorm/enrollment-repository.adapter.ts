import { AppDataSource } from './datasource';
import { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { Enrollment } from '../../../domain/entities/enrollment';
import { EnrollmentOrm } from './entities/enrollment.orm';

export class EnrollmentRepositoryAdapter implements EnrollmentRepository {
    private readonly repo = AppDataSource.getRepository(EnrollmentOrm);

    async findById(id: string): Promise<Enrollment | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByClassAndUser(classId: string, userId: string): Promise<Enrollment | null> {
        const row = await this.repo.findOne({ where: { courseClassId: classId, studentUserId: userId } });
        return row ? this.toDomain(row) : null;
    }

    async findByClassAndDependent(classId: string, dependentId: string): Promise<Enrollment | null> {
        const row = await this.repo.findOne({ where: { courseClassId: classId, dependentId } });
        return row ? this.toDomain(row) : null;
    }

    async findActiveByClassIds(classIds: string[]): Promise<Enrollment[]> {
        if (!classIds.length) return [];
        const rows = await this.repo.createQueryBuilder('enrollment')
            .where('enrollment.courseClassId IN (:...classIds)', { classIds })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getMany();
        return rows.map((row) => this.toDomain(row));
    }

    async save(enrollment: Enrollment): Promise<void> {
        await this.repo.save(this.toOrm(enrollment));
    }

    private toDomain(row: EnrollmentOrm): Enrollment {
        if (row.studentType === 'USER') {
            return Enrollment.createForUser({
                id: row.id,
                courseClassId: row.courseClassId,
                ownerUserId: row.ownerUserId,
                studentUserId: row.studentUserId!,
                status: row.status as any,
                enrolledAt: row.enrolledAt,
                updatedAt: row.updatedAt
            });
        }
        return Enrollment.createForDependent({
            id: row.id,
            courseClassId: row.courseClassId,
            ownerUserId: row.ownerUserId,
            dependentId: row.dependentId!,
            status: row.status as any,
            enrolledAt: row.enrolledAt,
            updatedAt: row.updatedAt
        });
    }

    private toOrm(enrollment: Enrollment): EnrollmentOrm {
        const row = new EnrollmentOrm();
        row.id = enrollment.id;
        row.courseClassId = enrollment.courseClassId;
        row.ownerUserId = enrollment.ownerUserId;
        row.studentType = enrollment.studentType;
        row.studentUserId = enrollment.studentUserId;
        row.dependentId = enrollment.dependentId;
        row.status = enrollment.status;
        row.enrolledAt = enrollment.enrolledAt;
        row.updatedAt = enrollment.updatedAt ?? new Date();
        return row;
    }
}


