import { UserRepository } from '../../ports/repositories/user.repo';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { TokenProviderPort } from '../../ports/providers/token-provider.port';
import { AuthTokenPayload } from '../contracts/auth-token-payload';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';

export class LoginAdmin {
    constructor(
        private readonly users: UserRepository,
        private readonly hasher: PasswordHasherPort,
        private readonly tokens: TokenProviderPort,
        private readonly defaultTtl: number
    ) {}

    async exec(input: { email: string; password: string; }): Promise<{
        accessToken: string;
        userId: string;
        fullName: string;
        email: string;
        cpf: string;
        persona: string;
        expiresIn: number;
    }> {
        const email = this.normalizeEmail(input.email);
        const user = await this.users.findByEmail(email);

        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (user.persona !== UserPersonaEnum.ADMIN) {
            throw new Error('Invalid credentials');
        }

        const valid = await this.hasher.compare(input.password, user.passwordHash);
        if (!valid) {
            throw new Error('Invalid credentials');
        }

        const expiresIn = this.defaultTtl;
        const payload: AuthTokenPayload = {
            sub: user.id,
            cpf: user.cpf,
            fullName: user.fullName,
            email: user.email.value,
            persona: user.persona
        };

        const accessToken = await this.tokens.sign(payload, { expiresIn });

        return {
            accessToken,
            userId: user.id,
            fullName: user.fullName,
            email: user.email.value,
            cpf: user.cpf,
            persona: user.persona,
            expiresIn
        };
    }

    private normalizeEmail(value: string): string {
        const normalized = value.trim().toLowerCase();
        if (!normalized) throw new Error('Invalid credentials');
        return normalized;
    }
}

