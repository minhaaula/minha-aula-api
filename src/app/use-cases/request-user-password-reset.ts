import { randomBytes } from 'crypto';
import { UserRepository } from '../../ports/repositories/user.repo';
import { PasswordResetTokenRepository } from '../../ports/repositories/password-reset-token.repo';
import { PasswordResetToken } from '../../domain/entities/password-reset-token';

type RequestUserPasswordResetInput = {
    email: string;
};

type RequestUserPasswordResetOutput = {
    message: string;
    token?: string; // Apenas para desenvolvimento/testes, em produção enviar por email
};

export class RequestUserPasswordReset {
    constructor(
        private readonly users: UserRepository,
        private readonly resetTokens: PasswordResetTokenRepository
    ) {}

    async exec(input: RequestUserPasswordResetInput): Promise<RequestUserPasswordResetOutput> {
        const email = input.email.trim().toLowerCase();
        
        // Buscar usuário pelo email
        const user = await this.users.findByEmail(email);
        
        // Por segurança, sempre retornar sucesso mesmo se o email não existir
        // (para não expor quais emails estão cadastrados)
        if (!user) {
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

