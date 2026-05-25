import { describe, expect, it } from 'vitest';
import { CreateSchool } from '../../src/app/use-cases/schools/create-school';
import { GetSchoolProfile } from '../../src/app/use-cases/schools/get-school-profile';
import { School } from '../../src/domain/entities/school';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { AppError } from '../../src/shared/errors';
import { createSchoolSchema } from '../../src/infra/http/validators/school-schemas';
import type { SchoolRepository } from '../../src/ports/repositories/school.repo';
import type { PasswordHasherPort } from '../../src/ports/providers/password-hasher.port';
import type { TokenProviderPort } from '../../src/ports/providers/token-provider.port';
import { toE164Brazil } from '../../src/shared/phone-e164';

class TestPasswordHasher implements PasswordHasherPort {
    async hash(password: string): Promise<string> {
        return `hash:${password}`;
    }
    async compare(password: string, hash: string): Promise<boolean> {
        return hash === `hash:${password}`;
    }
}

class InMemorySchoolRepository implements SchoolRepository {
    private readonly items = new Map<string, School>();

    async findById(id: string): Promise<School | null> {
        return this.items.get(id) ?? null;
    }

    async save(school: School): Promise<void> {
        this.items.set(school.id, school);
    }
}

class SignupVerifyTokenProvider implements TokenProviderPort {
    async sign(payload: object): Promise<string> {
        return JSON.stringify(payload);
    }

    async verify<T>(token: string): Promise<T> {
        return JSON.parse(token) as T;
    }
}

function schoolSignupVerificationToken(phone: string): string {
    const e164 = toE164Brazil(phone);
    if (!e164) throw new Error('invalid phone');
    return JSON.stringify({ typ: 'school_signup_phone', ph: e164 });
}

const baseAddress = {
    street: 'Rua Central',
    number: '100',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01234-000'
};

describe('associação sem fins lucrativos (escola)', () => {
    it('rejeita cadastro sem CNPJ quando isNonprofitAssociation é true (schema)', () => {
        const ownerWhatsapp = '(11) 99876-5432';
        expect(() => createSchoolSchema.parse({
            name: 'Associação Cultural',
            email: 'contato@associacao.org',
            phone: ownerWhatsapp,
            cnpj: null,
            isNonprofitAssociation: true,
            ownerName: 'João Silva',
            ownerCpf: '529.982.247-25',
            ownerEmail: 'joao@associacao.org',
            ownerWhatsapp,
            ownerWhatsappVerificationToken: 'token-placeholder',
            ownerPassword: 'senha12345',
            addresses: [baseAddress]
        })).toThrow();
    });

    it('cria escola com flag e CNPJ; /me retorna isNonprofitAssociation', async () => {
        const repo = new InMemorySchoolRepository();
        const signupTokens = new SignupVerifyTokenProvider();
        const create = new CreateSchool(repo, new TestPasswordHasher(), undefined, undefined, undefined, signupTokens);
        const ownerWhatsapp = '(11) 99876-5432';

        const created = await create.exec({
            name: 'Associação Educacional',
            email: 'contato@educ.org',
            phone: ownerWhatsapp,
            cnpj: '12.345.678/0001-90',
            isNonprofitAssociation: true,
            ownerWhatsapp,
            ownerWhatsappVerificationToken: schoolSignupVerificationToken(ownerWhatsapp),
            addresses: [baseAddress]
        });

        expect(created.isNonprofitAssociation).toBe(true);
        expect(created.cnpj).toBe('12345678000190');

        const getProfile = new GetSchoolProfile(repo);
        const profile = await getProfile.exec({ schoolId: created.id });
        expect(profile?.isNonprofitAssociation).toBe(true);
    });

    it('rejeita use case quando isNonprofitAssociation é true sem CNPJ', async () => {
        const repo = new InMemorySchoolRepository();
        const signupTokens = new SignupVerifyTokenProvider();
        const create = new CreateSchool(repo, new TestPasswordHasher(), undefined, undefined, undefined, signupTokens);
        const ownerWhatsapp = '(11) 99876-5432';

        await expect(create.exec({
            name: 'Associação',
            email: 'a@b.org',
            phone: ownerWhatsapp,
            cnpj: null,
            isNonprofitAssociation: true,
            ownerWhatsapp,
            ownerWhatsappVerificationToken: schoolSignupVerificationToken(ownerWhatsapp),
            addresses: [baseAddress]
        })).rejects.toBeInstanceOf(AppError);
    });

    it('persiste false por padrão', async () => {
        const repo = new InMemorySchoolRepository();
        const signupTokens = new SignupVerifyTokenProvider();
        const create = new CreateSchool(repo, new TestPasswordHasher(), undefined, undefined, undefined, signupTokens);
        const ownerWhatsapp = '(11) 99876-5432';

        const created = await create.exec({
            name: 'Escola Comum',
            email: 'comum@escola.com',
            phone: ownerWhatsapp,
            cnpj: '12.345.678/0001-90',
            ownerWhatsapp,
            ownerWhatsappVerificationToken: schoolSignupVerificationToken(ownerWhatsapp),
            addresses: [baseAddress]
        });

        expect(created.isNonprofitAssociation).toBe(false);
        const stored = await repo.findById(created.id);
        expect(stored?.isNonprofitAssociation).toBe(false);
    });
});
