import { Email } from '../../../domain/value-objects/email';
import { User } from '../../../domain/entities/user';
import { UserRepository } from '../../../ports/repositories/user.repo';
import type { AdminStudentListFilters, AdminStudentListResult } from '../../../ports/repositories/enrollment.repo';
import { UserOrm } from './entities/user.orm';
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

    async deactivateAccount(userId: string, motivo: string, descricao: string): Promise<void> {
        await this.repo.update(userId, {
            active: 0,
            deactivationReason: motivo.trim() || null,
            deactivationDescription: descricao.trim() || null
        });
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
        const rows = await qb
            .select([
                'user.id AS studentId',
                'user.full_name AS studentName',
                'user.cpf AS cpf',
                'user.address_street AS addressStreet',
                'user.address_number AS addressNumber',
                'user.address_complement AS addressComplement',
                'user.address_district AS addressDistrict',
                'user.address_city AS addressCity',
                'user.address_state AS addressState',
                'user.address_zip_code AS addressZipCode',
                'user.created_at AS createdAt'
            ])
            .addSelect(
                `(SELECT COUNT(*) FROM enrollments e WHERE e.student_user_id = user.id AND e.status = 'ACTIVE')`,
                'courseCount'
            )
            .orderBy('user.full_name', 'ASC')
            .skip(safeOffset)
            .take(safeLimit)
            .getRawMany();

        const items = (rows as any[]).map((row) => ({
            cpf: row.cpf ?? null,
            studentId: row.studentId,
            studentName: row.studentName ?? '',
            studentType: 'USER' as const,
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
            createdAt: row.createdAt,
            active: row.active !== 0,
            deactivationReason: row.deactivationReason ?? null,
            deactivationDescription: row.deactivationDescription ?? null
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
        row.active = user.active ? 1 : 0;
        row.deactivationReason = user.deactivationReason ?? null;
        row.deactivationDescription = user.deactivationDescription ?? null;
        return row;
    }
}


