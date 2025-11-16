import { SchoolRepository } from '../../ports/repositories/school.repo';
import { PasswordResetTokenRepository } from '../../ports/repositories/password-reset-token.repo';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';

type ResetPasswordInput = {
    token: string;
    newPassword: string;
};

type ResetPasswordOutput = {
    message: string;
};

export class ResetPassword {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly resetTokens: PasswordResetTokenRepository,
        private readonly passwordHasher: PasswordHasherPort
    ) {}

    async exec(input: ResetPasswordInput): Promise<ResetPasswordOutput> {
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

        // Buscar escola
        const school = await this.schools.findByOwnerEmail?.(resetToken.email);
        
        if (!school) {
            throw new Error('Usuário não encontrado');
        }

        // Hash da nova senha
        const hashedPassword = await this.passwordHasher.hash(newPassword);

        // Atualizar senha
        if (!this.schools.updateOwnerPassword) {
            throw new Error('Operação não suportada');
        }
        await this.schools.updateOwnerPassword(school.id, hashedPassword);

        // Marcar token como usado
        await this.resetTokens.markAsUsed(token);

        return {
            message: 'Senha redefinida com sucesso'
        };
    }
}

