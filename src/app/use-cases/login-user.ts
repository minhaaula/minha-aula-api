import { UserRepository } from 'src/ports/repositories/user.repo';
import { PasswordHasherPort } from 'src/ports/providers/password-hasher.port';
import { TokenProviderPort } from 'src/ports/providers/token-provider.port';
import { Email } from 'src/domain/value-objects/email';

export class LoginUser {
    constructor(
        private readonly users: UserRepository,
        private readonly hasher: PasswordHasherPort,
        private readonly tokens: TokenProviderPort,
        private readonly defaultTtl: number
    ) {}

    async exec(input: { email: string; password: string; }): Promise<{ accessToken: string; userId: string; email: string; expiresIn: number; }> {
        const email = Email.create(input.email);
        const user = await this.users.findByEmail(email.value);

        if (!user) throw new Error('Invalid credentials');

        const valid = await this.hasher.compare(input.password, user.passwordHash);

        if (!valid) throw new Error('Invalid credentials');

        const expiresIn = this.defaultTtl;
        const accessToken = await this.tokens.sign({ sub: user.id, email: user.email.value }, { expiresIn });
        
        return { accessToken, userId: user.id, email: user.email.value, expiresIn };
    }
}
