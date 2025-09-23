import { UserRepository } from 'src/ports/repositories/user.repo';
import { PasswordHasherPort } from 'src/ports/providers/password-hasher.port';
import { Email } from 'src/domain/value-objects/email';
import { User } from 'src/domain/entities/user';
import { Uuid } from 'src/shared/uuid';

export class RegisterUser {
    constructor(
        private readonly users: UserRepository,
        private readonly hasher: PasswordHasherPort
    ) {}

    async exec(input: { email: string; password: string; }): Promise<{ userId: string; email: string; createdAt: Date; }> {
        const email = Email.create(input.email);
        const existing = await this.users.findByEmail(email.value);

        if (existing) throw new Error('User already exists');
         
        const passwordHash = await this.hasher.hash(input.password);
        const user = User.create({ id: Uuid(), email, passwordHash });

        await this.users.save(user);
        
        return { userId: user.id, email: user.email.value, createdAt: user.createdAt };
    }
}
