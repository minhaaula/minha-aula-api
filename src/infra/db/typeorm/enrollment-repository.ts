import { In } from 'typeorm';
import { AppDataSource } from './datasource';
import { computeEnrollmentActiveSlotKeys } from './enrollment-active-slot-keys';
import {
    EnrollmentRepository,
    EnrollmentWithDetails,
    AdminStudentListFilters,
    AdminStudentListResult
} from '../../../ports/repositories/enrollment.repo';
import { Enrollment } from '../../../domain/entities/enrollment';
import { EnrollmentOrm } from './entities/enrollment.orm';

import { presentStudentAccountStatus } from '../../../app/types/admin.types';

function formatAdminStudentBirthDate(value: unknown): string | null {
    if (value == null) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    }
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

const BLOCKING_ENROLLMENT_STATUSES = ['ACTIVE', 'PENDING'] as const;

export class EnrollmentRepositoryAdapter implements EnrollmentRepository {
    private readonly repo = AppDataSource.getRepository(EnrollmentOrm);

    async findById(id: string): Promise<Enrollment | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByClassAndUser(classId: string, userId: string): Promise<Enrollment | null> {
        const row = await this.repo.findOne({
            where: {
                courseClassId: classId,
                studentUserId: userId,
                status: In([...BLOCKING_ENROLLMENT_STATUSES])
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findByClassAndDependent(classId: string, dependentId: string): Promise<Enrollment | null> {
        const row = await this.repo.findOne({
            where: {
                courseClassId: classId,
                dependentId,
                status: In([...BLOCKING_ENROLLMENT_STATUSES])
            }
        });
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

    async findActiveByDependentId(dependentId: string): Promise<Enrollment[]> {
        const rows = await this.repo.createQueryBuilder('enrollment')
            .where('enrollment.dependentId = :dependentId', { dependentId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getMany();
        return rows.map((row) => this.toDomain(row));
    }

    async save(enrollment: Enrollment): Promise<void> {
        await this.repo.save(this.toOrm(enrollment));
    }

    async countTotalActiveStudents(): Promise<number> {
        const row = await this.repo
            .createQueryBuilder('enrollment')
            .select(
                "COUNT(DISTINCT CONCAT(enrollment.studentType, '-', COALESCE(enrollment.studentUserId, enrollment.dependentId, '')))",
                'count'
            )
            .where('enrollment.status = :status', { status: 'ACTIVE' })
            .getRawOne<{ count: string }>();
        return Number(row?.count ?? 0);
    }

    async countEnrollmentsInMonth(year: number, month: number): Promise<number> {
        return this.repo
            .createQueryBuilder('enrollment')
            .where('YEAR(enrollment.enrolledAt) = :year', { year })
            .andWhere('MONTH(enrollment.enrolledAt) = :month', { month })
            .getCount();
    }

    async getTopSchoolsByStudentCount(limit: number): Promise<Array<{ schoolId: string; schoolName: string; city: string | null; count: number }>> {
        const rows = await this.repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .innerJoin('course.school', 'school')
            .leftJoin('school.addresses', 'addr')
            .where('enrollment.status = :status', { status: 'ACTIVE' })
            .select('school.id AS schoolId')
            .addSelect('school.name AS schoolName')
            .addSelect('MAX(addr.city)', 'city')
            .addSelect('COUNT(DISTINCT COALESCE(enrollment.studentUserId, enrollment.dependentId))', 'count')
            .groupBy('school.id')
            .addGroupBy('school.name')
            .orderBy('count', 'DESC')
            .limit(limit)
            .getRawMany();

        return (rows as any[]).map((r) => ({
            schoolId: r.schoolId,
            schoolName: r.schoolName ?? '',
            city: r.city ?? null,
            count: Number(r.count) || 0
        }));
    }

    async findRecent(limit: number): Promise<EnrollmentWithDetails[]> {
        const results = await this.repo
            .createQueryBuilder('enrollment')
            .leftJoin('users', 'user', 'user.id = enrollment.student_user_id')
            .leftJoin('dependents', 'dependent', 'dependent.id = enrollment.dependent_id')
            .leftJoin('course_classes', 'class', 'class.id = enrollment.course_class_id')
            .leftJoin('courses', 'course', 'course.id = class.course_id')
            .leftJoin('schools', 'school', 'school.id = course.school_id')
            .select([
                'COALESCE(user.id, dependent.id) as studentId',
                'COALESCE(user.full_name, dependent.full_name) as studentName',
                'COALESCE(user.cpf, dependent.cpf) as studentCpf',
                'enrollment.enrolled_at as createdAt',
                'course.name as courseName',
                'class.label as className',
                'school.name as schoolName'
            ])
            .orderBy('enrollment.enrolled_at', 'DESC')
            .limit(limit)
            .getRawMany();

        return results.map((row: any) => ({
            studentId: row.studentId,
            studentName: row.studentName,
            studentCpf: row.studentCpf,
            createdAt: new Date(row.createdAt),
            courseName: row.courseName,
            className: row.className,
            schoolName: row.schoolName
        }));
    }

    async findRecentBySchoolId(schoolId: string, limit: number): Promise<EnrollmentWithDetails[]> {
        const results = await this.repo
            .createQueryBuilder('enrollment')
            .leftJoin('enrollment.courseClass', 'class')
            .leftJoin('class.course', 'course')
            .leftJoin('course.school', 'school')
            .leftJoin('enrollment.studentUser', 'user')
            .leftJoin('enrollment.dependent', 'dependent')
            .where('school.id = :schoolId', { schoolId })
            .select([
                'COALESCE(user.id, dependent.id) as studentId',
                'COALESCE(user.fullName, dependent.fullName) as studentName',
                'COALESCE(user.cpf, dependent.cpf) as studentCpf',
                'enrollment.enrolledAt as createdAt',
                'course.name as courseName',
                'class.label as className',
                'school.name as schoolName'
            ])
            .orderBy('enrollment.enrolledAt', 'DESC')
            .limit(limit)
            .getRawMany();

        return results.map((row: any) => ({
            studentId: row.studentId,
            studentName: row.studentName,
            studentCpf: row.studentCpf,
            createdAt: new Date(row.createdAt),
            courseName: row.courseName,
            className: row.className,
            schoolName: row.schoolName
        }));
    }

    async countActiveBySchoolId(schoolId: string): Promise<number> {
        return await this.repo
            .createQueryBuilder('enrollment')
            .leftJoin('enrollment.courseClass', 'class')
            .leftJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getCount();
    }

    async findMyCourses(userId: string): Promise<import('../../../ports/repositories/enrollment.repo').MyCourseData[]> {
        const results = await this.repo
            .createQueryBuilder('enrollment')
            .leftJoin('enrollment.courseClass', 'courseClass')
            .leftJoin('enrollment.studentUser', 'studentUser')
            .leftJoin('enrollment.dependent', 'dependent')
            .leftJoin('courseClass.course', 'course')
            .leftJoin('course.school', 'school')
            .where('enrollment.ownerUserId = :userId', { userId })
            .andWhere('enrollment.status IN (:...statuses)', {
                statuses: ['ACTIVE', 'CANCELLED', 'COMPLETED']
            })
            .select([
                'course.id AS courseId',
                'course.name AS courseName',
                'course.isActive AS courseIsActive',
                'school.id AS schoolId',
                'school.name AS schoolName',
                'COALESCE(studentUser.fullName, dependent.fullName) AS studentName',
                'courseClass.schedule AS schedule',
                'enrollment.status AS enrollmentStatus'
            ])
            .orderBy('enrollment.enrolledAt', 'DESC')
            .getRawMany();

        return results.map((row: any) => {
            let schedule: Array<{ day: string; start: string; end: string }> = [];
            if (Array.isArray(row.schedule)) {
                schedule = row.schedule;
            } else if (typeof row.schedule === 'string') {
                try {
                    schedule = JSON.parse(row.schedule);
                } catch {
                    schedule = [];
                }
            }

            return {
                courseId: row.courseId,
                courseName: row.courseName,
                schoolId: row.schoolId,
                schoolName: row.schoolName,
                studentName: row.studentName,
                schedule,
                active: Boolean(row.courseIsActive),
                enrollmentStatus: row.enrollmentStatus as import('../../../ports/repositories/enrollment.repo').MyCourseEnrollmentStatus
            };
        });
    }

    async hasActiveEnrollmentInSchool(schoolId: string, userId: string): Promise<boolean> {
        // Verificar se existe matrícula do aluno (como usuário) na escola
        const userEnrollment = await this.repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.ownerUserId = :userId', { userId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getCount();

        if (userEnrollment > 0) {
            return true;
        }

        // Verificar se existe matrícula de algum dependente do usuário na escola
        const dependentEnrollment = await this.repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .innerJoin('enrollment.dependent', 'dependent')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('dependent.userId = :userId', { userId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getCount();

        return dependentEnrollment > 0;
    }

    async findAllPaginatedForAdmin(
        filters: AdminStudentListFilters,
        limit: number,
        offset: number
    ): Promise<AdminStudentListResult> {
        const schoolId = filters.schoolId?.trim() || null;
        const name = filters.name?.trim() || null;
        const cpfRaw = filters.cpf?.trim() || null;
        const cpfDigits = cpfRaw ? cpfRaw.replace(/\D/g, '') : null;
        const city = filters.city?.trim() || null;
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safeOffset = Math.max(0, offset);

        const qb = this.repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .innerJoin('course.school', 'school')
            .innerJoin('enrollment.studentUser', 'studentUser')
            .where('enrollment.status = :status', { status: 'ACTIVE' })
            .andWhere('enrollment.studentUserId IS NOT NULL')
            .andWhere('course.isActive = :courseActive', { courseActive: true })
            .andWhere('class.isActive = :classActive', { classActive: true });

        if (schoolId) {
            qb.andWhere('school.id = :schoolId', { schoolId });
        }
        if (name) {
            qb.andWhere('LOWER(studentUser.fullName) LIKE LOWER(:namePattern)', { namePattern: `%${name}%` });
        }
        if (cpfDigits && cpfDigits.length === 11) {
            qb.andWhere(
                'REPLACE(REPLACE(REPLACE(studentUser.cpf, \'.\', \'\'), \'-\', \'\'), \'/\', \'\') = :cpfDigits',
                { cpfDigits }
            );
        }
        if (city) {
            qb.andWhere('LOWER(studentUser.addressCity) LIKE LOWER(:cityPattern)', { cityPattern: `%${city}%` });
        }

        const countQb = this.repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .innerJoin('course.school', 'school')
            .innerJoin('enrollment.studentUser', 'studentUser')
            .where('enrollment.status = :status', { status: 'ACTIVE' })
            .andWhere('enrollment.studentUserId IS NOT NULL')
            .andWhere('course.isActive = :courseActive', { courseActive: true })
            .andWhere('class.isActive = :classActive', { classActive: true });

        if (schoolId) countQb.andWhere('school.id = :schoolId', { schoolId });
        if (name) {
            countQb.andWhere('LOWER(studentUser.fullName) LIKE LOWER(:namePattern)', { namePattern: `%${name}%` });
        }
        if (cpfDigits && cpfDigits.length === 11) {
            countQb.andWhere(
                'REPLACE(REPLACE(REPLACE(studentUser.cpf, \'.\', \'\'), \'-\', \'\'), \'/\', \'\') = :cpfDigits',
                { cpfDigits }
            );
        }
        if (city) {
            countQb.andWhere('LOWER(studentUser.addressCity) LIKE LOWER(:cityPattern)', { cityPattern: `%${city}%` });
        }

        const totalCount = await countQb
            .select('COUNT(DISTINCT enrollment.studentUserId)', 'cnt')
            .getRawOne<{ cnt: string }>()
            .then((r) => Number(r?.cnt ?? 0));

        const rawRows = await qb
            .select([
                'studentUser.id AS studentId',
                'studentUser.fullName AS studentName',
                'studentUser.cpf AS cpf',
                'studentUser.birthDate AS birthDate',
                'studentUser.addressStreet AS addressStreet',
                'studentUser.addressNumber AS addressNumber',
                'studentUser.addressComplement AS addressComplement',
                'studentUser.addressDistrict AS addressDistrict',
                'studentUser.addressCity AS addressCity',
                'studentUser.addressState AS addressState',
                'studentUser.addressZipCode AS addressZipCode',
                'studentUser.createdAt AS createdAt',
                'studentUser.active AS active'
            ])
            .addSelect(
                '(SELECT COUNT(*) FROM enrollments e2 WHERE e2.student_user_id = studentUser.id AND e2.status = \'ACTIVE\')',
                'courseCount'
            )
            .groupBy('studentUser.id')
            .addGroupBy('studentUser.fullName')
            .addGroupBy('studentUser.cpf')
            .addGroupBy('studentUser.birthDate')
            .addGroupBy('studentUser.addressStreet')
            .addGroupBy('studentUser.addressNumber')
            .addGroupBy('studentUser.addressComplement')
            .addGroupBy('studentUser.addressDistrict')
            .addGroupBy('studentUser.addressCity')
            .addGroupBy('studentUser.addressState')
            .addGroupBy('studentUser.addressZipCode')
            .addGroupBy('studentUser.createdAt')
            .addGroupBy('studentUser.active')
            .orderBy('studentUser.createdAt', 'DESC')
            .skip(safeOffset)
            .take(safeLimit)
            .getRawMany();

        const items = (rawRows as any[]).map((row) => ({
            cpf: row.cpf ?? null,
            studentId: row.studentId,
            studentName: row.studentName ?? '',
            status: presentStudentAccountStatus(Number(row.active ?? 1) !== 0),
            studentType: 'USER' as const,
            birthDate: formatAdminStudentBirthDate(row.birthDate),
            endereco: {
                street: row.addressStreet ?? '',
                number: row.addressNumber ?? '',
                complement: row.addressComplement ?? null,
                district: row.addressDistrict ?? null,
                city: row.addressCity ?? '',
                state: row.addressState ?? '',
                zipCode: row.addressZipCode ?? ''
            },
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
            countCursos: Number(row.courseCount ?? 0),
            dependentes: [] as import('../../../ports/repositories/enrollment.repo').AdminStudentListDependentItem[]
        }));

        return {
            items,
            total: totalCount,
            limit: safeLimit,
            offset: safeOffset
        };
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
                updatedAt: row.updatedAt,
                fullAmountCents: row.fullAmountCents,
                paymentDueDay: row.paymentDueDay,
                tuitionExemptionType: row.tuitionExemptionType,
                discountCents: row.discountCents ?? null,
                discountMonths: row.discountMonths ?? null,
                currentSchoolStudentLevelId: row.currentSchoolStudentLevelId
            });
        }
        return Enrollment.createForDependent({
            id: row.id,
            courseClassId: row.courseClassId,
            ownerUserId: row.ownerUserId,
            dependentId: row.dependentId!,
            status: row.status as any,
            enrolledAt: row.enrolledAt,
            updatedAt: row.updatedAt,
            fullAmountCents: row.fullAmountCents,
            paymentDueDay: row.paymentDueDay,
            tuitionExemptionType: row.tuitionExemptionType,
            discountCents: row.discountCents ?? null,
            discountMonths: row.discountMonths ?? null,
            currentSchoolStudentLevelId: row.currentSchoolStudentLevelId
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
        row.fullAmountCents = enrollment.fullAmountCents;
        row.tuitionExemptionType = enrollment.tuitionExemptionType;
        row.paymentDueDay = enrollment.paymentDueDay;
        row.discountCents = enrollment.discountCents;
        row.discountMonths = enrollment.discountMonths;
        row.currentSchoolStudentLevelId = enrollment.currentSchoolStudentLevelId;
        row.enrolledAt = enrollment.enrolledAt;
        row.updatedAt = new Date();
        const slots = computeEnrollmentActiveSlotKeys({
            courseClassId: enrollment.courseClassId,
            status: enrollment.status,
            studentUserId: enrollment.studentUserId,
            dependentId: enrollment.dependentId
        });
        row.activeClassStudentUserKey = slots.activeClassStudentUserKey;
        row.activeClassDependentKey = slots.activeClassDependentKey;
        return row;
    }
}


