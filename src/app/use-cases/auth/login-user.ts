import { UserRepository } from '../../../ports/repositories/user.repo';
import { PasswordHasherPort } from '../../../ports/providers/password-hasher.port';
import { TokenProviderPort } from '../../../ports/providers/token-provider.port';
import { AuthTokenPayload } from '../../contracts/auth-token-payload';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { AppError, ErrorCode } from '../../../shared/errors';
import { User } from '../../../domain/entities/user';
import { resolveStudentLoginTokenPersona } from '../../../shared/user-student-access';

export class LoginUser {
    private readonly allowedPersonas?: Set<string>;

    constructor(
        private readonly users: UserRepository,
        private readonly hasher: PasswordHasherPort,
        private readonly tokens: TokenProviderPort,
        private readonly defaultTtl: number,
        activeModules: readonly string[] = [],
        private readonly schools?: SchoolRepository
    ) {
        this.allowedPersonas = this.resolveAllowedPersonas(activeModules);
    }

    async exec(input: { cpf: string; password: string; }): Promise<{ accessToken: string; refreshToken: string; userId: string; fullName: string; email: string; cpf: string; persona: string; expiresIn: number; refreshTokenExpiresIn: number; schoolId?: string; studentAccessEnabled: boolean; }> {
        const cpf = this.normalizeCpf(input.cpf);
        const user = await this.users.findByCpf(cpf);

        if (!user) throw AppError.fromCode(ErrorCode.INVALID_CREDENTIALS);

        if (!user.active) {
            throw AppError.fromCode(ErrorCode.ACCOUNT_DEACTIVATED);
        }

        const valid = await this.hasher.compare(input.password, user.passwordHash);
        if (!valid) throw AppError.fromCode(ErrorCode.INVALID_CREDENTIALS);

        this.assertAllowedForStudentLogin(user);

        const tokenPersona = resolveStudentLoginTokenPersona(user);
        const expiresIn = this.defaultTtl;
        const payload: AuthTokenPayload = {
            sub: user.id,
            cpf: user.cpf,
            fullName: user.fullName,
            email: user.email.value,
            persona: tokenPersona
        };

        if (user.persona === UserPersonaEnum.SCHOOL) {
            const schoolId = await this.resolveSchoolIdForUser(user.id, user.email.value);
            if (schoolId) {
                payload.schoolId = schoolId;
            }
        }
        const accessToken = await this.tokens.sign(payload, { expiresIn });

        const refreshTokenExpiresIn = 30 * 24 * 60 * 60;
        const refreshPayload: AuthTokenPayload & { type: string } = {
            ...payload,
            type: 'refresh'
        };
        const refreshToken = await this.tokens.sign(refreshPayload, { expiresIn: refreshTokenExpiresIn });

        return {
            accessToken,
            refreshToken,
            userId: user.id,
            fullName: user.fullName,
            email: user.email.value,
            cpf: user.cpf,
            persona: tokenPersona,
            expiresIn,
            refreshTokenExpiresIn,
            schoolId: payload.schoolId,
            studentAccessEnabled: user.studentAccessEnabled
        };
    }

    private assertAllowedForStudentLogin(user: User): void {
        if (user.persona === UserPersonaEnum.SCHOOL && !user.studentAccessEnabled) {
            throw AppError.fromCode(ErrorCode.STUDENT_ACCESS_NOT_ENABLED);
        }

        if (!this.allowedPersonas) {
            return;
        }

        if (this.allowedPersonas.has(user.persona)) {
            return;
        }

        if (
            user.persona === UserPersonaEnum.SCHOOL
            && user.studentAccessEnabled
            && this.allowedPersonas.has(UserPersonaEnum.STUDENT)
        ) {
            return;
        }

        throw AppError.fromCode(ErrorCode.INVALID_CREDENTIALS);
    }

    private normalizeCpf(value: string) {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) throw AppError.fromCode(ErrorCode.INVALID_CPF);
        return digits;
    }

    private resolveAllowedPersonas(modules: readonly string[]) {
        if (!modules.length) return undefined;

        const allowed = new Set<string>();

        for (const module of modules) {
            switch (module.toLowerCase()) {
                case 'students':
                    allowed.add(UserPersonaEnum.STUDENT);
                    break;
                case 'schools':
                    allowed.add(UserPersonaEnum.SCHOOL);
                    break;
                case 'admin':
                case 'auth':
                    allowed.add(UserPersonaEnum.ADMIN);
                    break;
            }
        }

        return allowed.size > 0 ? allowed : undefined;
    }

    private async resolveSchoolIdForUser(userId: string, email: string): Promise<string | undefined> {
        const schoolsRepo = this.schools;
        if (!schoolsRepo) return undefined;
        if (schoolsRepo.findByOwnerUserId) {
            const owned = await schoolsRepo.findByOwnerUserId(userId);
            if (owned) return owned.id;
        }
        const schoolByEmail = await schoolsRepo.findByEmail?.(email);
        if (schoolByEmail) return schoolByEmail.id;

        const schoolById = await schoolsRepo.findById(userId);
        return schoolById?.id;
    }
}
