import { UserRepository } from '../../../ports/repositories/user.repo';
import { PasswordResetTokenRepository } from '../../../ports/repositories/password-reset-token.repo';
import { PasswordHasherPort } from '../../../ports/providers/password-hasher.port';

type ResetUserPasswordInput = {
    token: string;
    newPassword: string;
};

type ResetUserPasswordOutput = {
    message: string;
};

export class ResetUserPassword {
    constructor(
        private readonly users: UserRepository,
        private readonly resetTokens: PasswordResetTokenRepository,
        private readonly passwordHasher: PasswordHasherPort
    ) {}

    async exec(input: ResetUserPasswordInput): Promise<ResetUserPasswordOutput> {
        const { token, newPassword } = input;

        // Validar senha
        if (!newPassword || newPassword.length < 6) {
            throw new Error('A senha deve ter pelo menos 6 caracteres');
        }

        // Buscar token
        const resetToken = await this.resetTokens.findByToken(token);
        
        if (!resetToken) {
            throw new Error('Token inválido ou expirado');
        }

        // Validar se token é válido (não usado e não expirado)
        if (!resetToken.isValid()) {
            throw new Error('Token inválido ou expirado');
        }

        // Buscar usuário
        const user = await this.users.findByEmail(resetToken.email);
        
        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        // Hash da nova senha
        const hashedPassword = await this.passwordHasher.hash(newPassword);

        // Atualizar senha
        if (!this.users.updatePassword) {
            throw new Error('Operação não suportada');
        }
        await this.users.updatePassword(user.id, hashedPassword);

        // Marcar token como usado
        await this.resetTokens.markAsUsed(token);

        return {
            message: 'Senha redefinida com sucesso'
        };
    }
}

