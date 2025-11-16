import { Email } from '../../../domain/value-objects/email';
import { User } from '../../../domain/entities/user';
import { UserRepository } from '../../../ports/repositories/user.repo';
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

    async countByPersona(persona: string): Promise<number> {
        const normalized = persona.trim();
        if (!normalized) return 0;
        return await this.repo.count({ where: { persona: normalized } });
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


