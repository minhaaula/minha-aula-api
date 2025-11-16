import { describe, expect, it } from 'vitest';
import { RequestPasswordReset } from '../../src/app/use-cases/request-password-reset';
import { ResetPassword } from '../../src/app/use-cases/reset-password';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { PasswordResetTokenRepository } from '../../src/ports/repositories/password-reset-token.repo';
import { PasswordHasherPort } from '../../src/ports/providers/password-hasher.port';
import { School } from '../../src/domain/entities/school';
import { PasswordResetToken } from '../../src/domain/entities/password-reset-token';

class InMemorySchoolRepository implements SchoolRepository {
    private readonly items = new Map<string, School>();

    async findById(id: string): Promise<School | null> {
        return this.items.get(id) ?? null;
    }

    async findByOwnerEmail(email: string): Promise<School | null> {
        const normalized = email.trim().toLowerCase();
        if (!normalized) return null;
        return (
            Array.from(this.items.values()).find((item) => item.ownerEmail === normalized) ?? null
        );
    }

    async findAll(): Promise<School[]> {
        return Array.from(this.items.values());
    }

    async save(school: School): Promise<void> {
        this.items.set(school.id, school);
    }

    async updateOwnerPassword(schoolId: string, hashedPassword: string): Promise<void> {
        const school = this.items.get(schoolId);
        if (!school) return;
        
        const updated = School.create({
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            cnpj: school.cnpj,
            addresses: school.addresses,
            ownerUserId: school.ownerUserId,
            ownerName: school.ownerName,
            ownerCpf: school.ownerCpf,
            ownerEmail: school.ownerEmail,
            ownerPasswordHash: hashedPassword,
            accountId: school.accountId,
            incomeValue: school.incomeValue,
            createdAt: school.createdAt
        });
        
        this.items.set(schoolId, updated);
    }

    seed(school: School) {
        this.items.set(school.id, school);
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

describe('Password Reset Flow', () => {
    it('generates a reset token for an existing school owner email', async () => {
        const schools = new InMemorySchoolRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        
        const school = School.create({
            id: 'school-1',
            name: 'Escola Teste',
            email: 'contato@escola.com',
            phone: '11987654321',
            cnpj: '12345678000190',
            ownerEmail: 'owner@escola.com',
            ownerName: 'João Silva',
            ownerCpf: '12345678900',
            ownerPasswordHash: 'hashed:senha123',
            createdAt: new Date()
        });
        schools.seed(school);

        const useCase = new RequestPasswordReset(schools, tokens);
        const result = await useCase.exec({ email: 'owner@escola.com' });

        expect(result.message).toBeTruthy();
        expect(result.token).toBeTruthy();
    });

    it('returns success message even for non-existent email (security)', async () => {
        const schools = new InMemorySchoolRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();

        const useCase = new RequestPasswordReset(schools, tokens);
        const result = await useCase.exec({ email: 'naoexiste@escola.com' });

        expect(result.message).toBeTruthy();
        expect(result.token).toBeUndefined();
    });

    it('resets password with valid token', async () => {
        const schools = new InMemorySchoolRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        const hasher = new TestPasswordHasher();

        const school = School.create({
            id: 'school-2',
            name: 'Escola Reset',
            email: 'contato@reset.com',
            phone: '11987654321',
            cnpj: '12345678000191',
            ownerEmail: 'admin@reset.com',
            ownerName: 'Maria Santos',
            ownerCpf: '98765432100',
            ownerPasswordHash: 'hashed:senhaantiga',
            createdAt: new Date()
        });
        schools.seed(school);

        const requestUseCase = new RequestPasswordReset(schools, tokens);
        const requestResult = await requestUseCase.exec({ email: 'admin@reset.com' });

        expect(requestResult.token).toBeTruthy();

        const resetUseCase = new ResetPassword(schools, tokens, hasher);
        const resetResult = await resetUseCase.exec({
            token: requestResult.token!,
            newPassword: 'novaSenha456'
        });

        expect(resetResult.message).toBe('Senha redefinida com sucesso');

        const updated = await schools.findById(school.id);
        expect(updated?.ownerPasswordHash).toBe('hashed:novaSenha456');
    });

    it('rejects password reset with invalid token', async () => {
        const schools = new InMemorySchoolRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        const hasher = new TestPasswordHasher();

        const resetUseCase = new ResetPassword(schools, tokens, hasher);

        await expect(resetUseCase.exec({
            token: 'token-invalido',
            newPassword: 'novaSenha789'
        })).rejects.toThrow('Token inválido ou expirado');
    });

    it('rejects password reset with used token', async () => {
        const schools = new InMemorySchoolRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        const hasher = new TestPasswordHasher();

        const school = School.create({
            id: 'school-3',
            name: 'Escola Token Usado',
            email: 'contato@tokenusado.com',
            phone: '11987654321',
            cnpj: '12345678000192',
            ownerEmail: 'diretor@tokenusado.com',
            ownerName: 'Pedro Alves',
            ownerCpf: '11122233344',
            ownerPasswordHash: 'hashed:senha123',
            createdAt: new Date()
        });
        schools.seed(school);

        const requestUseCase = new RequestPasswordReset(schools, tokens);
        const requestResult = await requestUseCase.exec({ email: 'diretor@tokenusado.com' });

        const resetUseCase = new ResetPassword(schools, tokens, hasher);
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
        const schools = new InMemorySchoolRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        const hasher = new TestPasswordHasher();

        const school = School.create({
            id: 'school-4',
            name: 'Escola Token Expirado',
            email: 'contato@expirado.com',
            phone: '11987654321',
            cnpj: '12345678000193',
            ownerEmail: 'admin@expirado.com',
            ownerName: 'Ana Costa',
            ownerCpf: '55566677788',
            ownerPasswordHash: 'hashed:senha123',
            createdAt: new Date()
        });
        schools.seed(school);

        // Criar token expirado manualmente
        const expiredToken = PasswordResetToken.create({
            id: 'token-exp-1',
            email: 'admin@expirado.com',
            token: 'token-expirado-123',
            expiresAt: new Date(Date.now() - 1000), // Expirado há 1 segundo
            used: false
        });
        await tokens.save(expiredToken);

        const resetUseCase = new ResetPassword(schools, tokens, hasher);
        await expect(resetUseCase.exec({
            token: 'token-expirado-123',
            newPassword: 'novaSenha'
        })).rejects.toThrow('Token inválido ou expirado');
    });

    it('rejects password reset with short password', async () => {
        const schools = new InMemorySchoolRepository();
        const tokens = new InMemoryPasswordResetTokenRepository();
        const hasher = new TestPasswordHasher();

        const school = School.create({
            id: 'school-5',
            name: 'Escola Senha Curta',
            email: 'contato@senhacurta.com',
            phone: '11987654321',
            cnpj: '12345678000194',
            ownerEmail: 'admin@senhacurta.com',
            ownerName: 'Carlos Lima',
            ownerCpf: '99988877766',
            ownerPasswordHash: 'hashed:senha123',
            createdAt: new Date()
        });
        schools.seed(school);

        const requestUseCase = new RequestPasswordReset(schools, tokens);
        const requestResult = await requestUseCase.exec({ email: 'admin@senhacurta.com' });

        const resetUseCase = new ResetPassword(schools, tokens, hasher);
        await expect(resetUseCase.exec({
            token: requestResult.token!,
            newPassword: '12345' // Menos de 6 caracteres
        })).rejects.toThrow('A senha deve ter pelo menos 6 caracteres');
    });
});

