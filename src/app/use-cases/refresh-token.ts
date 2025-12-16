import { TokenProviderPort } from '../../ports/providers/token-provider.port';
import { UserRepository } from '../../ports/repositories/user.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AuthTokenPayload } from '../contracts/auth-token-payload';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import { AppError, ErrorCode } from '../../shared/errors';

export interface RefreshTokenInput {
    refreshToken: string;
}

export interface RefreshTokenOutput {
    accessToken: string;
    expiresIn: number;
}

export class RefreshToken {
    constructor(
        private readonly tokens: TokenProviderPort,
        private readonly users: UserRepository,
        private readonly schools?: SchoolRepository,
        private readonly defaultTtl: number = 3600
    ) {}

    async exec(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
        const { refreshToken } = input;

        if (!refreshToken || !refreshToken.trim()) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Refresh token é obrigatório'
            });
        }

        try {
            // Verificar o refresh token
            const payload = await this.tokens.verify<AuthTokenPayload & { type?: string }>(refreshToken);

            // Verificar se é um refresh token (não um access token)
            if (payload.type !== 'refresh') {
                throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                    message: 'Token inválido: não é um refresh token'
                });
            }

            // Verificar se o usuário ainda existe
            const userId = payload.sub;
            if (!userId) {
                throw AppError.fromCode(ErrorCode.UNAUTHORIZED, {
                    message: 'Token inválido'
                });
            }

            const user = await this.users.findById(userId);
            if (!user) {
                throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, {
                    userId
                });
            }

            // Criar novo access token com os dados atualizados do usuário
            const expiresIn = this.defaultTtl;
            const newPayload: AuthTokenPayload = {
                sub: user.id,
                cpf: user.cpf,
                fullName: user.fullName,
                email: user.email.value,
                persona: user.persona
            };

            // Se for escola, buscar schoolId
            if (user.persona === UserPersonaEnum.SCHOOL && this.schools) {
                const schoolId = await this.resolveSchoolIdForUser(user.id, user.email.value);
                if (schoolId) {
                    newPayload.schoolId = schoolId;
                }
            }

            const accessToken = await this.tokens.sign(newPayload, { expiresIn });

            return {
                accessToken,
                expiresIn
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            // Se o token estiver expirado ou inválido
            throw AppError.fromCode(ErrorCode.UNAUTHORIZED, {
                message: 'Refresh token inválido ou expirado'
            });
        }
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

