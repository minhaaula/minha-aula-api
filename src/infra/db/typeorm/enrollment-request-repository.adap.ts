import { AppDataSource } from './datasource';
import { EnrollmentRequestRepository } from '../../../ports/repositories/enrollment-request.repo';
import { EnrollmentRequest } from '../../../domain/entities/enrollment-request';
import { EnrollmentRequestOrm } from './entities/enrollment-request.orm';

export class EnrollmentRequestRepositoryAdapter implements EnrollmentRequestRepository {
    private readonly repo = AppDataSource.getRepository(EnrollmentRequestOrm);

    async findById(id: string): Promise<EnrollmentRequest | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByCourseClassAndTarget(params: { courseClassId: string; userId: string; dependentId: string | null; }): Promise<EnrollmentRequest | null> {
        const qb = this.repo.createQueryBuilder('request')
            .where('request.courseClassId = :courseClassId', { courseClassId: params.courseClassId })
            .andWhere('request.requestedForUserId = :userId', { userId: params.userId });

        if (params.dependentId) {
            qb.andWhere('request.requestedForDependentId = :dependentId', { dependentId: params.dependentId });
        } else {
            qb.andWhere('request.requestedForDependentId IS NULL');
        }

        const row = await qb.getOne();
        return row ? this.toDomain(row) : null;
    }

    async save(request: EnrollmentRequest): Promise<void> {
        await this.repo.save(this.toOrm(request));
    }

    private toDomain(row: EnrollmentRequestOrm): EnrollmentRequest {
        const entity = EnrollmentRequest.create({
            id: row.id,
            schoolId: row.schoolId,
            courseClassId: row.courseClassId,
            requestedForUserId: row.requestedForUserId,
            requestedForDependentId: row.requestedForDependentId,
            notes: row.notes,
            createdAt: row.createdAt
        });
        (entity as any)._status = row.status;
        (entity as any)._decidedAt = row.decidedAt;
        (entity as any)._decidedByUserId = row.decidedByUserId;
        (entity as any)._notes = row.notes;
        (entity as any)._enrollmentId = row.enrollmentId;
        return entity;
    }

    private toOrm(request: EnrollmentRequest): EnrollmentRequestOrm {
        const row = new EnrollmentRequestOrm();
        row.id = request.id;
        row.schoolId = request.schoolId;
        row.courseClassId = request.courseClassId;
        row.requestedForUserId = request.requestedForUserId;
        row.requestedForDependentId = request.requestedForDependentId;
        row.status = request.status;
        row.decidedAt = request.decidedAt;
        row.decidedByUserId = request.decidedByUserId;
        row.notes = request.notes ?? null;
        row.enrollmentId = request.enrollmentId;
        row.createdAt = request.createdAt;
        return row;
    }
}
