import { describe, expect, it, vi } from 'vitest';
import { RequestPasswordReset } from '../../src/app/use-cases/request-password-reset';
import { RequestUserPasswordReset } from '../../src/app/use-cases/request-user-password-reset';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { PasswordResetTokenRepository } from '../../src/ports/repositories/password-reset-token.repo';
import { EmailProviderPort, SendEmailInput } from '../../src/ports/providers/email-provider.port';
import { School } from '../../src/domain/entities/school';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
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

    seed(school: School) {
        this.items.set(school.id, school);
    }
}

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

    async markAsUsed(_token: string): Promise<void> {
        // Implementação simplificada para testes
    }

    async deleteExpired(): Promise<void> {
        // Implementação simplificada para testes
    }
}

class MockEmailProvider implements EmailProviderPort {
    public sentEmails: SendEmailInput[] = [];

    async sendEmail(input: SendEmailInput): Promise<void> {
        this.sentEmails.push(input);
    }

    clear() {
        this.sentEmails = [];
    }
}

describe('Email Password Reset', () => {
    describe('School Password Reset - Email Sending', () => {
        it('sends email when requesting password reset for existing school', async () => {
            const schools = new InMemorySchoolRepository();
            const tokens = new InMemoryPasswordResetTokenRepository();
            const emailProvider = new MockEmailProvider();

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

            const useCase = new RequestPasswordReset(schools, tokens, emailProvider, 'http://localhost:3000');
            const result = await useCase.exec({ email: 'owner@escola.com' });

            expect(result.message).toBeTruthy();
            expect(emailProvider.sentEmails).toHaveLength(1);
            
            const sentEmail = emailProvider.sentEmails[0];
            expect(sentEmail.to).toBe('owner@escola.com');
            expect(sentEmail.subject).toBe('Redefinição de Senha');
            expect(sentEmail.html).toContain('Redefinição de Senha');
            expect(sentEmail.html).toContain('http://localhost:3000/reset-password?token=');
            expect(sentEmail.text).toContain('Use este token:');
        });

        it('does not send email when school does not exist (security)', async () => {
            const schools = new InMemorySchoolRepository();
            const tokens = new InMemoryPasswordResetTokenRepository();
            const emailProvider = new MockEmailProvider();

            const useCase = new RequestPasswordReset(schools, tokens, emailProvider);
            const result = await useCase.exec({ email: 'naoexiste@escola.com' });

            expect(result.message).toBeTruthy();
            expect(emailProvider.sentEmails).toHaveLength(0);
        });

        it('includes token in email when frontend URL is not provided', async () => {
            const schools = new InMemorySchoolRepository();
            const tokens = new InMemoryPasswordResetTokenRepository();
            const emailProvider = new MockEmailProvider();

            const school = School.create({
                id: 'school-2',
                name: 'Escola Sem URL',
                email: 'contato@escola2.com',
                phone: '11987654321',
                cnpj: '12345678000191',
                ownerEmail: 'admin@escola2.com',
                ownerName: 'Maria Santos',
                ownerCpf: '98765432100',
                ownerPasswordHash: 'hashed:senha123',
                createdAt: new Date()
            });
            schools.seed(school);

            const useCase = new RequestPasswordReset(schools, tokens, emailProvider);
            await useCase.exec({ email: 'admin@escola2.com' });

            expect(emailProvider.sentEmails).toHaveLength(1);
            const sentEmail = emailProvider.sentEmails[0];
            expect(sentEmail.html).toContain('Token:');
            expect(sentEmail.text).toContain('Use este token:');
        });
    });

    describe('User Password Reset - Email Sending', () => {
        it('sends email when requesting password reset for existing user', async () => {
            const users = new InMemoryUserRepository();
            const tokens = new InMemoryPasswordResetTokenRepository();
            const emailProvider = new MockEmailProvider();

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

            const useCase = new RequestUserPasswordReset(users, tokens, emailProvider, 'http://localhost:3000');
            const result = await useCase.exec({ email: 'joao@email.com' });

            expect(result.message).toBeTruthy();
            expect(emailProvider.sentEmails).toHaveLength(1);
            
            const sentEmail = emailProvider.sentEmails[0];
            expect(sentEmail.to).toBe('joao@email.com');
            expect(sentEmail.subject).toBe('Redefinição de Senha');
            expect(sentEmail.html).toContain('Redefinição de Senha');
            expect(sentEmail.html).toContain('http://localhost:3000/reset-password?token=');
            expect(sentEmail.text).toContain('Use este token:');
        });

        it('does not send email when user does not exist (security)', async () => {
            const users = new InMemoryUserRepository();
            const tokens = new InMemoryPasswordResetTokenRepository();
            const emailProvider = new MockEmailProvider();

            const useCase = new RequestUserPasswordReset(users, tokens, emailProvider);
            const result = await useCase.exec({ email: 'naoexiste@email.com' });

            expect(result.message).toBeTruthy();
            expect(emailProvider.sentEmails).toHaveLength(0);
        });

        it('includes expiration warning in email', async () => {
            const users = new InMemoryUserRepository();
            const tokens = new InMemoryPasswordResetTokenRepository();
            const emailProvider = new MockEmailProvider();

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
                passwordHash: 'hashed:senha123',
                createdAt: new Date()
            });
            users.seed(user);

            const useCase = new RequestUserPasswordReset(users, tokens, emailProvider);
            await useCase.exec({ email: 'maria@email.com' });

            expect(emailProvider.sentEmails).toHaveLength(1);
            const sentEmail = emailProvider.sentEmails[0];
            expect(sentEmail.html).toContain('1 hora');
            expect(sentEmail.text).toContain('1 hora');
        });
    });
});

