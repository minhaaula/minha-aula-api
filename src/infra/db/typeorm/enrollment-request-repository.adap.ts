import { AppDataSource } from './datasource';
import {
    EnrollmentRequestRepository,
    EnrollmentRequestWithDetails
} from '../../../ports/repositories/enrollment-request.repo';
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
    }): Promise<EnrollmentRequestWithDetails[]> {
        const qb = this.repo
            .createQueryBuilder('request')
            .innerJoinAndSelect('request.courseClass', 'courseClass')
            .innerJoinAndSelect('courseClass.course', 'course')
            .innerJoinAndSelect('request.requestedFor', 'student')
            .leftJoinAndSelect('request.dependent', 'dependent');

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
            qb.andWhere('student.cpf = :studentDocument', { studentDocument: params.studentDocument });
        }

        const limit = params.limit ?? 50;
        qb.orderBy('request.createdAt', 'DESC');
        qb.take(Math.max(1, Math.min(limit, 100)));

        if (typeof params.offset === 'number' && params.offset > 0) {
            qb.skip(params.offset);
        }

        const rows = await qb.getMany();
        return rows.map((row) => ({
            request: this.toDomain(row),
            courseClassLabel: row.courseClass?.label ?? null,
            courseLabel: row.courseClass?.course?.name ?? null,
            studentName: row.requestedFor.fullName,
            dependentName: row.dependent?.fullName ?? null
        }));
    }

    async save(request: EnrollmentRequest): Promise<void> {
        await this.repo.save(this.toOrm(request));
    }

    private toDomain(row: EnrollmentRequestOrm): EnrollmentRequest {
        const enrollmentFeeDueDate = row.enrollmentFeeDueDate
            ? new Date(row.enrollmentFeeDueDate)
            : null;
        const firstMonthlyPaymentDate = row.firstMonthlyPaymentDate
            ? new Date(row.firstMonthlyPaymentDate)
            : new Date(row.createdAt);

        const entity = EnrollmentRequest.create({
            id: row.id,
            schoolId: row.schoolId,
            courseClassId: row.courseClassId,
            requestedForUserId: row.requestedForUserId,
            requestedForDependentId: row.requestedForDependentId,
            notes: row.notes,
            discountCents: row.discountCents ?? null,
            enrollmentFeeCents: row.enrollmentFeeCents ?? null,
            enrollmentFeeDueDate,
            firstMonthlyPaymentDate,
            createdAt: row.createdAt
        });
        (entity as any)._status = row.status;
        (entity as any)._decidedAt = row.decidedAt;
        (entity as any)._decidedByUserId = row.decidedByUserId;
        (entity as any)._notes = row.notes;
        (entity as any)._discountCents = row.discountCents ?? null;
        (entity as any)._enrollmentFeeCents = row.enrollmentFeeCents ?? null;
        (entity as any)._enrollmentFeeDueDate = enrollmentFeeDueDate;
        (entity as any)._firstMonthlyPaymentDate = firstMonthlyPaymentDate;
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
        row.discountCents = request.discountCents ?? null;
        row.enrollmentFeeCents = request.enrollmentFeeCents ?? null;
        row.enrollmentFeeDueDate = request.enrollmentFeeDueDate
            ? request.enrollmentFeeDueDate.toISOString().slice(0, 10)
            : null;
        row.firstMonthlyPaymentDate = request.firstMonthlyPaymentDate.toISOString().slice(0, 10);
        row.enrollmentId = request.enrollmentId;
        row.createdAt = request.createdAt;
        return row;
    }
}
