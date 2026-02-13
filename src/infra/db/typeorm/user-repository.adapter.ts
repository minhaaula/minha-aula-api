import { Email } from '../../../domain/value-objects/email';
import { User } from '../../../domain/entities/user';
import { UserRepository } from '../../../ports/repositories/user.repo';
import type { AdminStudentListFilters, AdminStudentListResult } from '../../../ports/repositories/enrollment.repo';
import { UserOrm } from './entities/user.orm';
import { EnrollmentOrm } from './entities/enrollment.orm';
import { AppDataSource } from './datasource';
import { PostalAddress } from '../../../domain/value-objects/postal-address';
import { assertUserPersona } from '../../../domain/value-objects/user-persona';

export class UserRepositoryAdapter implements UserRepository {
    private readonly repo = AppDataSource.getRepository(UserOrm);

    async findByEmail(email: string): Promise<User | null> {
        const row = await this.repo.findOne({ where: { email: email.toLowerCase() } });
        return row ? this.toDomain(row) : null;
    }

    async findByCpf(cpf: string): Promise<User | null> {
        const sanitized = cpf.replace(/\D/g, '');
        const row = await this.repo.findOne({ where: { cpf: sanitized } });
        return row ? this.toDomain(row) : null;
    }

    async findById(id: string): Promise<User | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByPersona(persona: string): Promise<User[]> {
        const normalized = persona.trim();
        if (!normalized) return [];
        const rows = await this.repo.find({ where: { persona: normalized } });
        return rows.map((row) => this.toDomain(row));
    }

    async findBySchoolId(schoolId: string): Promise<User[]> {
        const normalized = schoolId.trim();
        if (!normalized) return [];

        const rows = await this.repo
            .createQueryBuilder('user')
            .distinct(true)
            .innerJoin('enrollments', 'enrollment', 'enrollment.student_user_id = user.id')
            .innerJoin('course_classes', 'class', 'class.id = enrollment.course_class_id')
            .innerJoin('courses', 'course', 'course.id = class.course_id')
            .where('course.school_id = :schoolId', { schoolId: normalized })
            .andWhere('user.persona = :persona', { persona: 'STUDENT' })
            .getMany();

        return rows.map((row) => this.toDomain(row));
    }

    async save(user: User): Promise<void> {
        await this.repo.save(this.toOrm(user));
    }

    async updatePassword(userId: string, hashedPassword: string): Promise<void> {
        await this.repo.update(userId, { passwordHash: hashedPassword });
    }

    async countByPersona(persona: string): Promise<number> {
        const normalized = persona.trim();
        if (!normalized) return 0;
        return await this.repo.count({ where: { persona: normalized } });
    }

    async findStudentsPaginatedForAdmin(
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
            .createQueryBuilder('user')
            .where('user.persona = :persona', { persona: 'STUDENT' });

        if (schoolId) {
            qb.andWhere(
                `user.id IN (SELECT e.student_user_id FROM enrollments e
                 INNER JOIN course_classes cc ON cc.id = e.course_class_id
                 INNER JOIN courses c ON c.id = cc.course_id
                 WHERE c.school_id = :schoolId AND e.student_user_id IS NOT NULL AND e.status = 'ACTIVE')`,
                { schoolId }
            );
        }
        if (name) {
            qb.andWhere('LOWER(user.full_name) LIKE LOWER(:namePattern)', { namePattern: `%${name}%` });
        }
        if (cpfDigits && cpfDigits.length === 11) {
            qb.andWhere('REPLACE(REPLACE(REPLACE(user.cpf, \'.\', \'\'), \'-\', \'\'), \'/\', \'\') = :cpfDigits', {
                cpfDigits
            });
        }

        const total = await qb.getCount();
        const users = await qb
            .select(['user.id', 'user.fullName', 'user.cpf'])
            .orderBy('user.full_name', 'ASC')
            .skip(safeOffset)
            .take(safeLimit)
            .getMany();

        const userIds = users.map((u) => u.id);
        const latestByUser = new Map<string, { enrollmentId: string; schoolId: string; schoolName: string; courseName: string; className: string; enrolledAt: Date }>();
        if (userIds.length > 0) {
            const enrollmentRepo = AppDataSource.getRepository(EnrollmentOrm);
            const latestEnrollments = await enrollmentRepo
                .createQueryBuilder('e')
                .innerJoin('e.courseClass', 'cc')
                .innerJoin('cc.course', 'c')
                .innerJoin('c.school', 's')
                .select([
                    'e.id AS enrollmentId',
                    'e.studentUserId AS studentUserId',
                    'e.enrolledAt AS enrolledAt',
                    's.id AS schoolId',
                    's.name AS schoolName',
                    'c.name AS courseName',
                    'cc.label AS className'
                ])
                .where('e.studentUserId IN (:...userIds)', { userIds })
                .andWhere('e.status = :status', { status: 'ACTIVE' })
                .andWhere('e.studentUserId IS NOT NULL')
                .orderBy('e.enrolledAt', 'DESC')
                .getRawMany();

            for (const row of latestEnrollments as any[]) {
                const uid = row.studentUserId;
                if (uid && !latestByUser.has(uid)) {
                    latestByUser.set(uid, {
                        enrollmentId: row.enrollmentId,
                        schoolId: row.schoolId,
                        schoolName: row.schoolName,
                        courseName: row.courseName,
                        className: row.className,
                        enrolledAt: new Date(row.enrolledAt)
                    });
                }
            }
        }

        const items = users.map((u) => {
            const en = latestByUser.get(u.id);
            return {
                enrollmentId: en?.enrollmentId ?? null,
                schoolId: en?.schoolId ?? null,
                schoolName: en?.schoolName ?? null,
                studentName: u.fullName ?? '',
                cpf: u.cpf ?? null,
                courseName: en?.courseName ?? null,
                className: en?.className ?? null,
                enrolledAt: en?.enrolledAt ?? null,
                studentType: 'USER' as const,
                studentId: u.id
            };
        });

        return {
            items,
            total,
            limit: safeLimit,
            offset: safeOffset
        };
    }

    private toDomain(row: UserOrm): User {
        const address = PostalAddress.create({
            street: row.addressStreet,
            number: row.addressNumber,
            complement: row.addressComplement,
            district: row.addressDistrict,
            city: row.addressCity,
            state: row.addressState,
            zipCode: row.addressZipCode
        });

        return User.create({
            id: row.id,
            fullName: row.fullName,
            birthDate: new Date(row.birthDate),
            email: Email.create(row.email),
            phone: row.phone,
            cpf: row.cpf,
            address,
            persona: row.persona,
            passwordHash: row.passwordHash,
            createdAt: row.createdAt
        });
    }

    private toOrm(user: User): UserOrm {
        const row = new UserOrm();
        row.id = user.id;
        row.fullName = user.fullName;
        row.birthDate = user.birthDate;
        row.email = user.email.value;
        row.phone = user.phone;
        row.cpf = user.cpf;
        row.addressStreet = user.address.street;
        row.addressNumber = user.address.number;
        row.addressComplement = user.address.complement;
        row.addressDistrict = user.address.district;
        row.addressCity = user.address.city;
        row.addressState = user.address.state;
        row.addressZipCode = user.address.zipCode;
        assertUserPersona(user.persona);
        row.persona = user.persona;
        row.passwordHash = user.passwordHash;
        row.createdAt = user.createdAt;
        return row;
    }
}


