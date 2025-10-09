import { SchoolRepository } from '../../ports/repositories/school.repo';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { TokenProviderPort } from '../../ports/providers/token-provider.port';
import { AuthTokenPayload } from '../contracts/auth-token-payload';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';

export class LoginSchool {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly hasher: PasswordHasherPort,
        private readonly tokens: TokenProviderPort,
        private readonly defaultTtl: number
    ) {}

    async exec(input: { email: string; password: string; }): Promise<{
        accessToken: string;
        schoolId: string;
        ownerName: string;
        ownerEmail: string;
        expiresIn: number;
    }> {
        const email = this.normalizeEmail(input.email);
        const school = await this.findSchoolByOwnerEmail(email);

        if (!school?.ownerPasswordHash) {
            throw new Error('Invalid credentials');
        }

        const passwordMatches = await this.hasher.compare(input.password, school.ownerPasswordHash);
        if (!passwordMatches) {
            throw new Error('Invalid credentials');
        }

        const ownerCpf = school.ownerCpf;
        if (!ownerCpf) {
            throw new Error('Invalid credentials');
        }

        const ownerName = school.ownerName ?? school.name;
        const ownerEmail = school.ownerEmail ?? email;
        const expiresIn = this.defaultTtl;

        const payload: AuthTokenPayload = {
            sub: school.ownerUserId ?? school.id,
            persona: UserPersonaEnum.SCHOOL,
            email: ownerEmail,
            fullName: ownerName,
            cpf: ownerCpf,
            schoolId: school.id
        };

        const accessToken = await this.tokens.sign(payload, { expiresIn });

        return {
            accessToken,
            schoolId: school.id,
            ownerName,
            ownerEmail,
            expiresIn
        };
    }

    private normalizeEmail(value: string): string {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            throw new Error('Invalid credentials');
        }
        return normalized;
    }

    private async findSchoolByOwnerEmail(email: string) {
        if (this.schools.findByOwnerEmail) {
            return this.schools.findByOwnerEmail(email);
        }
        return null;
    }
}
