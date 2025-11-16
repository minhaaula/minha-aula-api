import { randomBytes } from 'crypto';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { PasswordResetTokenRepository } from '../../ports/repositories/password-reset-token.repo';
import { PasswordResetToken } from '../../domain/entities/password-reset-token';

type RequestPasswordResetInput = {
    email: string;
};

type RequestPasswordResetOutput = {
    message: string;
    token?: string; // Apenas para desenvolvimento/testes, em produção enviar por email
};

export class RequestPasswordReset {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly resetTokens: PasswordResetTokenRepository
    ) {}

    async exec(input: RequestPasswordResetInput): Promise<RequestPasswordResetOutput> {
        const email = input.email.trim().toLowerCase();
        
        // Buscar escola pelo email do owner
        const school = await this.schools.findByOwnerEmail?.(email);
        
        // Por segurança, sempre retornar sucesso mesmo se o email não existir
        // (para não expor quais emails estão cadastrados)
        if (!school) {
            return {
                message: 'Se o email estiver cadastrado, você receberá um link para redefinir sua senha.'
            };
        }

        // Gerar token único
        const token = this.generateToken();
        const tokenId = randomBytes(16).toString('hex');
        
        // Token expira em 1 hora
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        const resetToken = PasswordResetToken.create({
            id: tokenId,
            email,
            token,
            expiresAt
        });

        await this.resetTokens.save(resetToken);

        // TODO: Em produção, enviar email com o link
        // Para desenvolvimento, retornar o token
        const isDevelopment = process.env.NODE_ENV !== 'production';

        return {
            message: 'Se o email estiver cadastrado, você receberá um link para redefinir sua senha.',
            ...(isDevelopment && { token })
        };
    }

    private generateToken(): string {
        return randomBytes(32).toString('hex');
    }
}

