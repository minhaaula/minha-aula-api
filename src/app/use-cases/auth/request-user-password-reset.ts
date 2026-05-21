import { randomBytes } from 'crypto';
import { UserRepository } from '../../../ports/repositories/user.repo';
import { PasswordResetTokenRepository } from '../../../ports/repositories/password-reset-token.repo';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token';
import { EmailProviderPort } from '../../../ports/providers/email-provider.port';

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
        private readonly resetTokens: PasswordResetTokenRepository,
        private readonly emailProvider?: EmailProviderPort,
        private readonly frontendBaseUrl?: string
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

        // Enviar email com o token
        const isDevelopment = process.env.NODE_ENV !== 'production';
        
        if (this.emailProvider) {
            try {
                const resetUrl = this.frontendBaseUrl 
                    ? `${this.frontendBaseUrl}/reset-password?token=${token}`
                    : `Token: ${token}`;
                
                await this.emailProvider.sendEmail({
                    to: email,
                    subject: 'Redefinição de Senha',
                    html: `
                        <h2>Redefinição de Senha</h2>
                        <p>Você solicitou a redefinição de senha. Use o token abaixo para redefinir sua senha:</p>
                        <p><strong>${resetUrl}</strong></p>
                        <p>Este token expira em 1 hora.</p>
                        <p>Se você não solicitou esta redefinição, ignore este email.</p>
                    `,
                    text: `Você solicitou a redefinição de senha. Use este token: ${token}. Este token expira em 1 hora.`
                });
                // Não logar email ou token por segurança
                console.log('Email de reset de senha enviado com sucesso');
            } catch (error) {
                console.error(`Erro ao enviar email de reset de senha para ${email}:`, error);
                // Não lançar erro para não expor que o email existe
            }
        } else {
            console.warn('EmailProvider não configurado. Variáveis de ambiente EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS devem estar definidas.');
        }

        return {
            message: 'Se o email estiver cadastrado, você receberá um link para redefinir sua senha.',
            ...(isDevelopment && !this.emailProvider && { token })
        };
    }

    private generateToken(): string {
        return randomBytes(32).toString('hex');
    }
}

