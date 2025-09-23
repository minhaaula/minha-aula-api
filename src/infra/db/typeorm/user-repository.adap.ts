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
            email: Email.create(row.email),
            passwordHash: row.passwordHash,
            createdAt: row.createdAt
        });
    }

    private toOrm(user: User): UserOrm {
        const row = new UserOrm();
        row.id = user.id;
        row.email = user.email.value;
        row.passwordHash = user.passwordHash;
        row.createdAt = user.createdAt;
        return row;
    }
}
