import { UserRepository } from '../../ports/repositories/user.repo';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { TokenProviderPort } from '../../ports/providers/token-provider.port';

export class LoginUser {
    constructor(
        private readonly users: UserRepository,
        private readonly hasher: PasswordHasherPort,
        private readonly tokens: TokenProviderPort,
        private readonly defaultTtl: number
    ) {}

    async exec(input: { cpf: string; password: string; }): Promise<{ accessToken: string; userId: string; fullName: string; email: string; cpf: string; expiresIn: number; }> {
        const cpf = this.normalizeCpf(input.cpf);
        const user = await this.users.findByCpf(cpf);

        if (!user) throw new Error('Invalid credentials');

        const valid = await this.hasher.compare(input.password, user.passwordHash);
        if (!valid) throw new Error('Invalid credentials');

        const expiresIn = this.defaultTtl;
        const accessToken = await this.tokens.sign({ sub: user.id, cpf: user.cpf, fullName: user.fullName, email: user.email.value }, { expiresIn });

        return {
            accessToken,
            userId: user.id,
            fullName: user.fullName,
            email: user.email.value,
            cpf: user.cpf,
            expiresIn
        };
    }

    private normalizeCpf(value: string) {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) throw new Error('Invalid credentials');
        return digits;
    }
}
