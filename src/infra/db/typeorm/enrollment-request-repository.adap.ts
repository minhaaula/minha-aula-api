import { AppDataSource } from './datasource';
import { EnrollmentRequestRepository } from '../../../ports/repositories/enrollment-request.repo';
import { EnrollmentRequest, EnrollmentRequestStatus } from '../../../domain/entities/enrollment-request';
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

    async findMany(params: {
        schoolId?: string;
        courseClassId?: string;
        courseId?: string;
        status?: EnrollmentRequestStatus;
        requestedForUserId?: string;
        requestedForDependentId?: string | null;
        studentDocument?: string;
        limit?: number;
        offset?: number;
    }): Promise<EnrollmentRequest[]> {
        const qb = this.repo.createQueryBuilder('request');
        let courseClassJoined = false;
        let studentJoined = false;

        const ensureCourseClassJoin = () => {
            if (!courseClassJoined) {
                qb.innerJoin('request.courseClass', 'courseClass');
                courseClassJoined = true;
            }
        };

        const ensureStudentJoin = () => {
            if (!studentJoined) {
                qb.innerJoin('request.requestedFor', 'student');
                studentJoined = true;
            }
        };

        if (params.schoolId) {
            qb.andWhere('request.schoolId = :schoolId', { schoolId: params.schoolId });
        }

        if (params.courseClassId) {
            qb.andWhere('request.courseClassId = :courseClassId', { courseClassId: params.courseClassId });
        }

        if (params.status) {
            qb.andWhere('request.status = :status', { status: params.status });
        }

        if (params.courseId) {
            ensureCourseClassJoin();
            qb.andWhere('courseClass.courseId = :courseId', { courseId: params.courseId });
        }

        if (params.requestedForUserId) {
            qb.andWhere('request.requestedForUserId = :requestedForUserId', { requestedForUserId: params.requestedForUserId });
        }

        if (params.requestedForDependentId === null) {
            qb.andWhere('request.requestedForDependentId IS NULL');
        } else if (params.requestedForDependentId) {
            qb.andWhere('request.requestedForDependentId = :requestedForDependentId', { requestedForDependentId: params.requestedForDependentId });
        }

        if (params.studentDocument) {
            ensureStudentJoin();
            qb.andWhere('student.cpf = :studentDocument', { studentDocument: params.studentDocument });
        }

        const limit = params.limit ?? 50;
        qb.orderBy('request.createdAt', 'DESC');
        qb.take(Math.max(1, Math.min(limit, 100)));

        if (typeof params.offset === 'number' && params.offset > 0) {
            qb.skip(params.offset);
        }

        const rows = await qb.getMany();
        return rows.map((row) => this.toDomain(row));
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
