import { AppDataSource } from './datasource';
import {
    EnrollmentRequestRepository,
    EnrollmentRequestWithDetails,
    AdminEnrollmentRequestItem
} from '../../../ports/repositories/enrollment-request.repo';
import { EnrollmentRequest, EnrollmentRequestStatus } from '../../../domain/entities/enrollment-request';
import { EnrollmentRequestOrm } from './entities/enrollment-request.orm';
import { computeEnrollmentRequestActivePendingKey } from './enrollment-request-active-slot-key';

/** Inclui variantes legadas (ex.: CANCELED) quando a lista pede CANCELLED. */
function expandEnrollmentStatusIn(statuses: EnrollmentRequestStatus[]): string[] {
    const out = new Set<string>();
    for (const s of statuses) {
        out.add(s);
        if (s === 'CANCELLED') {
            out.add('CANCELED');
        }
    }
    return [...out];
}

export class EnrollmentRequestRepositoryAdapter implements EnrollmentRequestRepository {
    private readonly repo = AppDataSource.getRepository(EnrollmentRequestOrm);

    async findById(id: string): Promise<EnrollmentRequest | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByCourseClassAndTarget(params: { courseClassId: string; userId: string; dependentId: string | null; }): Promise<EnrollmentRequest | null> {
        return this.findLatestApprovedByCourseClassAndTarget(params);
    }

    async findPendingByCourseClassAndTarget(params: {
        courseClassId: string;
        userId: string;
        dependentId: string | null;
    }): Promise<EnrollmentRequest | null> {
        const qb = this.repo.createQueryBuilder('request')
            .where('request.courseClassId = :courseClassId', { courseClassId: params.courseClassId })
            .andWhere('request.requestedForUserId = :userId', { userId: params.userId })
            .andWhere('request.status = :status', { status: 'PENDING' });

        if (params.dependentId) {
            qb.andWhere('request.requestedForDependentId = :dependentId', { dependentId: params.dependentId });
        } else {
            qb.andWhere('request.requestedForDependentId IS NULL');
        }

        const row = await qb.getOne();
        return row ? this.toDomain(row) : null;
    }

    async findLatestApprovedByCourseClassAndTarget(params: {
        courseClassId: string;
        userId: string;
        dependentId: string | null;
    }): Promise<EnrollmentRequest | null> {
        const qb = this.repo.createQueryBuilder('request')
            .where('request.courseClassId = :courseClassId', { courseClassId: params.courseClassId })
            .andWhere('request.requestedForUserId = :userId', { userId: params.userId })
            .andWhere('request.status = :status', { status: 'APPROVED' })
            .orderBy('request.createdAt', 'DESC');

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
        statusIn?: EnrollmentRequestStatus[];
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
            .innerJoinAndSelect('request.school', 'school')
            .leftJoinAndSelect('school.addresses', 'schoolAddresses')
            .leftJoinAndSelect('request.dependent', 'dependent');

        if (params.schoolId) {
            qb.andWhere('request.schoolId = :schoolId', { schoolId: params.schoolId });
        }

        if (params.courseClassId) {
            qb.andWhere('request.courseClassId = :courseClassId', { courseClassId: params.courseClassId });
        }

        if (params.statusIn?.length) {
            const statuses = expandEnrollmentStatusIn(params.statusIn);
            qb.andWhere('request.status IN (:...statuses)', { statuses });
        } else if (params.status) {
            if (params.status === 'CANCELLED') {
                // Legado: alguns registros usam "CANCELED" (1 L); o ENUM atual só tem CANCELLED.
                qb.andWhere('request.status IN (:...cancelledStatuses)', {
                    cancelledStatuses: ['CANCELLED', 'CANCELED']
                });
            } else {
                qb.andWhere('request.status = :status', { status: params.status });
            }
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
        return rows.map((row) => {
            const mainAddress = row.school?.addresses?.[0];
            const schoolAddress = mainAddress
                ? {
                    street: mainAddress.street,
                    number: mainAddress.number,
                    complement: mainAddress.complement ?? null,
                    district: mainAddress.district ?? null,
                    city: mainAddress.city,
                    state: mainAddress.state,
                    zipCode: mainAddress.zipCode
                }
                : null;
            const isDependent = row.dependent != null;
            const studentBirthDate = isDependent
                ? (row.dependent?.birthDate ? new Date(row.dependent.birthDate) : null)
                : (row.requestedFor?.birthDate ? new Date(row.requestedFor.birthDate) : null);

            return {
                request: this.toDomain(row),
                courseClassLabel: row.courseClass?.label ?? null,
                courseLabel: row.courseClass?.course?.name ?? null,
                studentName: row.requestedFor.fullName,
                dependentName: row.dependent?.fullName ?? null,
                schoolName: row.school?.name ?? null,
                monthlyPriceCents: row.courseClass?.monthlyPriceCents ?? null,
                schedule: Array.isArray(row.courseClass?.schedule) ? row.courseClass.schedule : null,
                schoolAddress,
                schoolWhatsapp: row.school?.ownerWhatsapp?.trim() || null,
                studentBirthDate,
                dependentRelationship: row.dependent?.relationship?.trim() || null
            };
        });
    }

    async findManyForAdmin(params: {
        studentName?: string | null;
        studentCpf?: string | null;
        schoolName?: string | null;
        status?: EnrollmentRequestStatus | null;
        limit?: number;
        offset?: number;
    }): Promise<{ items: AdminEnrollmentRequestItem[]; total: number }> {
        const studentName = params.studentName?.trim() || null;
        const studentCpf = params.studentCpf?.trim().replace(/\D/g, '') || null;
        const schoolName = params.schoolName?.trim() || null;
        const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
        const offset = Math.max(0, params.offset ?? 0);

        const qb = this.repo
            .createQueryBuilder('request')
            .innerJoinAndSelect('request.courseClass', 'courseClass')
            .innerJoinAndSelect('courseClass.course', 'course')
            .innerJoinAndSelect('request.requestedFor', 'student')
            .innerJoinAndSelect('request.school', 'school')
            .leftJoinAndSelect('request.dependent', 'dependent');

        if (studentName) {
            qb.andWhere(
                '(LOWER(student.fullName) LIKE LOWER(:studentName) OR (dependent.id IS NOT NULL AND LOWER(dependent.fullName) LIKE LOWER(:studentName)))',
                { studentName: `%${studentName}%` }
            );
        }
        if (studentCpf) {
            qb.andWhere(
                '(student.cpf = :studentCpf OR (dependent.id IS NOT NULL AND dependent.cpf = :studentCpf))',
                { studentCpf }
            );
        }
        if (schoolName) {
            qb.andWhere('LOWER(school.name) LIKE LOWER(:schoolName)', { schoolName: `%${schoolName}%` });
        }
        if (params.status) {
            qb.andWhere('request.status = :status', { status: params.status });
        }

        qb.orderBy('request.createdAt', 'DESC');

        const [rows, total] = await qb
            .skip(offset)
            .take(limit)
            .getManyAndCount();

        const items: AdminEnrollmentRequestItem[] = rows.map((row) => ({
            request: this.toDomain(row),
            courseClassLabel: row.courseClass?.label ?? null,
            courseLabel: row.courseClass?.course?.name ?? null,
            studentName: row.requestedFor.fullName,
            dependentName: row.dependent?.fullName ?? null,
            schoolName: row.school?.name ?? '',
            schoolCnpj: row.school?.cnpj?.trim() ? row.school.cnpj.trim() : null,
            schoolOwnerCpf: row.school?.ownerCpf?.trim() ? row.school.ownerCpf.trim() : null
        }));

        return { items, total };
    }

    async countPendingBySchoolId(schoolId: string): Promise<number> {
        return await this.repo.count({
            where: { schoolId, status: 'PENDING' }
        });
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
            discountMonths: row.discountMonths ?? null,
            enrollmentFeeCents: row.enrollmentFeeCents ?? null,
            enrollmentFeeDueDate,
            firstMonthlyPaymentDate,
            tuitionExemptionType: row.tuitionExemptionType ?? null,
            createdAt: row.createdAt
        });
        const rawStatus = (row.status as unknown as string) ?? 'PENDING';
        // Compat: já existiram dados legados com "CANCELED" (1 L). Normaliza para "CANCELLED".
        (entity as any)._status = rawStatus === 'CANCELED' ? 'CANCELLED' : rawStatus;
        (entity as any)._decidedAt = row.decidedAt;
        (entity as any)._decidedByUserId = row.decidedByUserId;
        (entity as any)._notes = row.notes;
        (entity as any)._discountCents = row.discountCents ?? null;
        (entity as any)._discountMonths = row.discountMonths ?? null;
        (entity as any)._enrollmentFeeCents = row.enrollmentFeeCents ?? null;
        (entity as any)._enrollmentFeeDueDate = enrollmentFeeDueDate;
        (entity as any)._firstMonthlyPaymentDate = firstMonthlyPaymentDate;
        (entity as any)._tuitionExemptionType = row.tuitionExemptionType ?? null;
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
        row.discountMonths = request.discountMonths ?? null;
        row.enrollmentFeeCents = request.enrollmentFeeCents ?? null;
        row.enrollmentFeeDueDate = request.enrollmentFeeDueDate
            ? request.enrollmentFeeDueDate.toISOString().slice(0, 10)
            : null;
        row.firstMonthlyPaymentDate = request.firstMonthlyPaymentDate.toISOString().slice(0, 10);
        row.tuitionExemptionType = request.tuitionExemptionType;
        row.enrollmentId = request.enrollmentId;
        row.createdAt = request.createdAt;
        row.activePendingTargetKey = computeEnrollmentRequestActivePendingKey({
            courseClassId: request.courseClassId,
            status: request.status,
            requestedForUserId: request.requestedForUserId,
            requestedForDependentId: request.requestedForDependentId
        });
        return row;
    }
}


