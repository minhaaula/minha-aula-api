import { describe, expect, it } from 'vitest';
import { RequestUserPasswordReset } from '../../src/app/use-cases/auth/request-user-password-reset';
import { ResetUserPassword } from '../../src/app/use-cases/auth/reset-user-password';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { PasswordResetTokenRepository } from '../../src/ports/repositories/password-reset-token.repo';
import { PasswordHasherPort } from '../../src/ports/providers/password-hasher.port';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { PasswordResetToken } from '../../src/domain/entities/password-reset-token';

class InMemoryUserRepository implements UserRepository {
    private readonly items = new Map<string, User>();

    async findByEmail(email: string): Promise<User | null> {
        const normalized = email.trim().toLowerCase();
        return Array.from(this.items.values()).find((u) => u.email.value === normalized) ?? null;
    }

    async findByCpf(_cpf: string): Promise<User | null> {
        return null;
    }

    async findById(id: string): Promise<User | null> {
        return this.items.get(id) ?? null;
    }

    async findByPersona(_persona: string): Promise<User[]> {
        return [];
    }

    async save(user: User): Promise<void> {
        this.items.set(user.id, user);
    }

    async updatePassword(userId: string, hashedPassword: string): Promise<void> {
        const user = this.items.get(userId);
        if (!user) return;

        const updated = User.create({
            id: user.id,
            fullName: user.fullName,
            birthDate: user.birthDate,
            email: user.email,
            phone: user.phone,
            cpf: user.cpf,
            address: user.address,
            persona: user.persona,
            passwordHash: hashedPassword,
            createdAt: user.createdAt
        });

        this.items.set(userId, updated);
    }

    seed(user: User) {
        this.items.set(user.id, user);
    }
}

class InMemoryPasswordResetTokenRepository implements PasswordResetTokenRepository {
    private readonly tokens = new Map<string, PasswordResetToken>();

    async save(token: PasswordResetToken): Promise<void> {
        this.tokens.set(token.token, token);
    }

    async findByToken(token: string): Promise<PasswordResetToken | null> {
        return this.tokens.get(token) ?? null;
    }

    async markAsUsed(token: string): Promise<void> {
        const resetToken = this.tokens.get(token);
        if (!resetToken) return;

        const updated = PasswordResetToken.create({
            id: resetToken.id,
            email: resetToken.email,
            token: resetToken.token,
            expiresAt: resetToken.expiresAt,
            used: true,
            createdAt: resetToken.createdAt
        });

        this.tokens.set(token, updated);
    }

    async deleteExpired(): Promise<void> {
        const now = new Date();
        for (const [token, resetToken] of this.tokens.entries()) {
            if (resetToken.expiresAt < now) {
                this.tokens.delete(token);
            }
        }
    }
}

class TestPasswordHasher implements PasswordHasherPort {
    async hash(plain: string): Promise<string> {
        return `hashed:${plain}`;
    }

    async compare(plain: string, hashed: string): Promise<boolean> {
        return hashed === `hashed:${plain}`;
    }
}

describe('User Password Reset Flow', () => {
    it('generates a reset token for an existing user email', async () => {
        const users = new InMemoryUserRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        
        const user = User.create({
            id: 'user-1',
            fullName: 'João Silva',
            birthDate: new Date('1990-01-01'),
            email: Email.create('joao@email.com'),
            phone: '11987654321',
            cpf: '12345678900',
            address: PostalAddress.create({
                street: 'Rua A',
                number: '100',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234000'
            }),
            persona: 'STUDENT',
            passwordHash: 'hashed:senha123',
            createdAt: new Date()
        });
        users.seed(user);

        const useCase = new RequestUserPasswordReset(users, tokens);
        const result = await useCase.exec({ email: 'joao@email.com' });

        expect(result.message).toBeTruthy();
        expect(result.token).toBeTruthy();
    });

    it('returns success message even for non-existent email (security)', async () => {
        const users = new InMemoryUserRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();

        const useCase = new RequestUserPasswordReset(users, tokens);
        const result = await useCase.exec({ email: 'naoexiste@email.com' });

        expect(result.message).toBeTruthy();
        expect(result.token).toBeUndefined();
    });

    it('resets password with valid token', async () => {
        const users = new InMemoryUserRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        const hasher = new TestPasswordHasher();

        const user = User.create({
            id: 'user-2',
            fullName: 'Maria Santos',
            birthDate: new Date('1992-05-15'),
            email: Email.create('maria@email.com'),
            phone: '11987654321',
            cpf: '98765432100',
            address: PostalAddress.create({
                street: 'Rua B',
                number: '200',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234000'
            }),
            persona: 'STUDENT',
            passwordHash: 'hashed:senhaantiga',
            createdAt: new Date()
        });
        users.seed(user);

        const requestUseCase = new RequestUserPasswordReset(users, tokens);
        const requestResult = await requestUseCase.exec({ email: 'maria@email.com' });

        expect(requestResult.token).toBeTruthy();

        const resetUseCase = new ResetUserPassword(users, tokens, hasher);
        const resetResult = await resetUseCase.exec({
            token: requestResult.token!,
            newPassword: 'novaSenha456'
        });

        expect(resetResult.message).toBe('Senha redefinida com sucesso');

        const updated = await users.findById(user.id);
        expect(updated?.passwordHash).toBe('hashed:novaSenha456');
    });

    it('rejects password reset with invalid token', async () => {
        const users = new InMemoryUserRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        const hasher = new TestPasswordHasher();

        const resetUseCase = new ResetUserPassword(users, tokens, hasher);

        await expect(resetUseCase.exec({
            token: 'token-invalido',
            newPassword: 'novaSenha789'
        })).rejects.toThrow('Token inválido ou expirado');
    });

    it('rejects password reset with used token', async () => {
        const users = new InMemoryUserRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        const hasher = new TestPasswordHasher();

        const user = User.create({
            id: 'user-3',
            fullName: 'Pedro Alves',
            birthDate: new Date('1988-03-20'),
            email: Email.create('pedro@email.com'),
            phone: '11987654321',
            cpf: '11122233344',
            address: PostalAddress.create({
                street: 'Rua C',
                number: '300',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234000'
            }),
            persona: 'STUDENT',
            passwordHash: 'hashed:senha123',
            createdAt: new Date()
        });
        users.seed(user);

        const requestUseCase = new RequestUserPasswordReset(users, tokens);
        const requestResult = await requestUseCase.exec({ email: 'pedro@email.com' });

        const resetUseCase = new ResetUserPassword(users, tokens, hasher);
        await resetUseCase.exec({
            token: requestResult.token!,
            newPassword: 'primeiraNovaSenha'
        });

        // Tentar usar o mesmo token novamente
        await expect(resetUseCase.exec({
            token: requestResult.token!,
            newPassword: 'segundaNovaSenha'
        })).rejects.toThrow('Token inválido ou expirado');
    });

    it('rejects password reset with expired token', async () => {
        const users = new InMemoryUserRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        const hasher = new TestPasswordHasher();

        const user = User.create({
            id: 'user-4',
            fullName: 'Ana Costa',
            birthDate: new Date('1995-07-10'),
            email: Email.create('ana@email.com'),
            phone: '11987654321',
            cpf: '55566677788',
            address: PostalAddress.create({
                street: 'Rua D',
                number: '400',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234000'
            }),
            persona: 'STUDENT',
            passwordHash: 'hashed:senha123',
            createdAt: new Date()
        });
        users.seed(user);

        // Criar token expirado manualmente
        const expiredToken = PasswordResetToken.create({
            id: 'token-exp-1',
            email: 'ana@email.com',
            token: 'token-expirado-123',
            expiresAt: new Date(Date.now() - 1000), // Expirado há 1 segundo
            used: false
        });
        await tokens.save(expiredToken);

        const resetUseCase = new ResetUserPassword(users, tokens, hasher);
        await expect(resetUseCase.exec({
            token: 'token-expirado-123',
            newPassword: 'novaSenha'
        })).rejects.toThrow('Token inválido ou expirado');
    });

    it('rejects password reset with short password', async () => {
        const users = new InMemoryUserRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        const hasher = new TestPasswordHasher();

        const user = User.create({
            id: 'user-5',
            fullName: 'Carlos Lima',
            birthDate: new Date('1991-11-25'),
            email: Email.create('carlos@email.com'),
            phone: '11987654321',
            cpf: '99988877766',
            address: PostalAddress.create({
                street: 'Rua E',
                number: '500',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234000'
            }),
            persona: 'STUDENT',
            passwordHash: 'hashed:senha123',
            createdAt: new Date()
        });
        users.seed(user);

        const requestUseCase = new RequestUserPasswordReset(users, tokens);
        const requestResult = await requestUseCase.exec({ email: 'carlos@email.com' });

        const resetUseCase = new ResetUserPassword(users, tokens, hasher);
        await expect(resetUseCase.exec({
            token: requestResult.token!,
            newPassword: '12345' // Menos de 6 caracteres
        })).rejects.toThrow('A senha deve ter pelo menos 6 caracteres');
    });
});

