import { AppDataSource } from './datasource';
import {
    EnrollmentRepository,
    EnrollmentWithDetails,
    AdminStudentListFilters,
    AdminStudentListResult
} from '../../../ports/repositories/enrollment.repo';
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
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .andWhere('course.isActive = :isActive', { isActive: true })
            .andWhere('courseClass.isActive = :isActive', { isActive: true })
            .select([
                'course.id AS courseId',
                'course.name AS courseName',
                'school.id AS schoolId',
                'school.name AS schoolName',
                'COALESCE(studentUser.fullName, dependent.fullName) AS studentName',
                'courseClass.schedule AS schedule'
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
                schedule: schedule
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
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safeOffset = Math.max(0, offset);

        const qb = this.repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .innerJoin('course.school', 'school')
            .leftJoin('enrollment.studentUser', 'studentUser')
            .leftJoin('enrollment.dependent', 'dependent')
            .where('enrollment.status = :status', { status: 'ACTIVE' })
            .andWhere('course.isActive = :courseActive', { courseActive: true })
            .andWhere('class.isActive = :classActive', { classActive: true });

        if (schoolId) {
            qb.andWhere('school.id = :schoolId', { schoolId });
        }
        if (name) {
            qb.andWhere(
                '(LOWER(COALESCE(studentUser.fullName, dependent.fullName)) LIKE LOWER(:namePattern))',
                { namePattern: `%${name}%` }
            );
        }
        if (cpfDigits && cpfDigits.length === 11) {
            qb.andWhere(
                'REPLACE(REPLACE(REPLACE(COALESCE(studentUser.cpf, dependent.cpf), \'.\', \'\'), \'-\', \'\'), \'/\', \'\') = :cpfDigits',
                { cpfDigits }
            );
        }

        const rawRows = await qb
            .select([
                'enrollment.id AS enrollmentId',
                'school.id AS schoolId',
                'school.name AS schoolName',
                'COALESCE(studentUser.fullName, dependent.fullName) AS studentName',
                'COALESCE(studentUser.cpf, dependent.cpf) AS cpf',
                'course.name AS courseName',
                'class.label AS className',
                'enrollment.enrolledAt AS enrolledAt',
                'enrollment.studentType AS studentType',
                'COALESCE(studentUser.id, dependent.id) AS studentId'
            ])
            .orderBy('enrollment.enrolledAt', 'DESC')
            .skip(safeOffset)
            .take(safeLimit)
            .getRawMany();

        const countQb = this.repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .innerJoin('course.school', 'school')
            .leftJoin('enrollment.studentUser', 'studentUser')
            .leftJoin('enrollment.dependent', 'dependent')
            .where('enrollment.status = :status', { status: 'ACTIVE' })
            .andWhere('course.isActive = :courseActive', { courseActive: true })
            .andWhere('class.isActive = :classActive', { classActive: true });

        if (schoolId) countQb.andWhere('school.id = :schoolId', { schoolId });
        if (name) {
            countQb.andWhere(
                '(LOWER(COALESCE(studentUser.fullName, dependent.fullName)) LIKE LOWER(:namePattern))',
                { namePattern: `%${name}%` }
            );
        }
        if (cpfDigits && cpfDigits.length === 11) {
            countQb.andWhere(
                'REPLACE(REPLACE(REPLACE(COALESCE(studentUser.cpf, dependent.cpf), \'.\', \'\'), \'-\', \'\'), \'/\', \'\') = :cpfDigits',
                { cpfDigits }
            );
        }
        const totalCount = await countQb.getCount();

        const items = (rawRows as any[]).map((row) => ({
            enrollmentId: row.enrollmentId as string,
            schoolId: row.schoolId as string,
            schoolName: row.schoolName as string,
            studentName: row.studentName ?? '',
            cpf: row.cpf ?? null,
            courseName: row.courseName ?? '',
            className: row.className ?? '',
            enrolledAt: new Date(row.enrolledAt),
            studentType: row.studentType as 'USER' | 'DEPENDENT',
            studentId: row.studentId
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
                paymentDueDay: row.paymentDueDay
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
            paymentDueDay: row.paymentDueDay
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
        row.paymentDueDay = enrollment.paymentDueDay;
        row.enrolledAt = enrollment.enrolledAt;
        row.updatedAt = enrollment.updatedAt ?? new Date();
        return row;
    }
}


