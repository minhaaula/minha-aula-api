import { Email } from 'src/domain/value-objects/email';
import { User } from 'src/domain/entities/user';
import { UserRepository } from 'src/ports/repositories/user.repo';
import { UserOrm } from './entities/user.orm';
import { AppDataSource } from './datasource';

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

    async save(user: User): Promise<void> {
        await this.repo.save(this.toOrm(user));
    }

    private toDomain(row: UserOrm): User {
        return User.create({
            id: row.id,
            fullName: row.fullName,
            birthDate: new Date(row.birthDate),
            email: Email.create(row.email),
            phone: row.phone,
            cpf: row.cpf,
            address: row.address,
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
        row.address = user.address;
        row.passwordHash = user.passwordHash;
        row.createdAt = user.createdAt;
        return row;
    }
}
