import { describe, expect, it } from 'vitest';
import { RequestSchoolActionOtp } from '../../src/app/use-cases/request-school-action-otp';
import { VerifySchoolActionOtp } from '../../src/app/use-cases/verify-school-action-otp';
import { ConsumeSchoolActionOtp } from '../../src/app/use-cases/consume-school-action-otp';
import { SchoolActionOtp } from '../../src/domain/entities/school-action-otp';
import { School } from '../../src/domain/entities/school';
import type {
    SendWhatsAppContentTemplateInput,
    SendWhatsAppInput,
    WhatsAppProviderPort
} from '../../src/ports/providers/whatsapp-provider.port';
import type { SchoolActionOtpRepository } from '../../src/ports/repositories/school-action-otp.repo';
import type { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { Uuid } from '../../src/shared/uuid';

class InMemorySchoolRepository implements SchoolRepository {
    private readonly items = new Map<string, School>();

    async findById(id: string): Promise<School | null> {
        return this.items.get(id) ?? null;
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

class InMemorySchoolActionOtpRepository implements SchoolActionOtpRepository {
    private readonly items = new Map<string, SchoolActionOtp>();

    async save(otp: SchoolActionOtp): Promise<void> {
        this.items.set(otp.id, otp);
    }

    async findById(id: string): Promise<SchoolActionOtp | null> {
        return this.items.get(id) ?? null;
    }

    async findLatestBySchoolAndPurpose(schoolId: string, purpose: 'WITHDRAWAL' | 'BANK_ACCOUNT_CHANGE'): Promise<SchoolActionOtp | null> {
        return Array.from(this.items.values())
            .filter((item) => item.schoolId === schoolId && item.purpose === purpose)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    }
}

class FakeWhatsAppProvider implements WhatsAppProviderPort {
    readonly messages: SendWhatsAppInput[] = [];
    readonly contentTemplates: SendWhatsAppContentTemplateInput[] = [];

    async sendMessage(input: SendWhatsAppInput): Promise<void> {
        this.messages.push(input);
    }

    async sendContentTemplate(input: SendWhatsAppContentTemplateInput): Promise<void> {
        this.contentTemplates.push(input);
    }
}

describe('School action OTP', () => {
    it('requests an OTP and sends it to the school WhatsApp', async () => {
        const schools = new InMemorySchoolRepository();
        const otps = new InMemorySchoolActionOtpRepository();
        const whatsapp = new FakeWhatsAppProvider();
        const school = School.create({
            id: Uuid(),
            name: 'Escola OTP',
            email: 'otp@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190'
        });
        schools.seed(school);

        const useCase = new RequestSchoolActionOtp(schools, otps, whatsapp, {
            contentSid: 'HX00000000000000000000000000000001'
        });
        const result = await useCase.exec({ schoolId: school.id, purpose: 'WITHDRAWAL' });

        expect(result.challengeId).toBeTruthy();
        expect(result.purpose).toBe('WITHDRAWAL');
        expect(whatsapp.contentTemplates).toHaveLength(1);
        expect(whatsapp.contentTemplates[0]?.to).toBe('11999999999');
        expect(whatsapp.contentTemplates[0]?.contentSid).toBe('HX00000000000000000000000000000001');
        expect(whatsapp.contentTemplates[0]?.contentVariables['1']).toMatch(
            /^Seu codigo OTP para confirmar o saque e \d{6}\. Ele expira em 10 minutos\.$/
        );
    });

    it('verifies and consumes an OTP for a sensitive action', async () => {
        const otps = new InMemorySchoolActionOtpRepository();
        const otp = SchoolActionOtp.create({
            id: Uuid(),
            schoolId: 'school-1',
            purpose: 'BANK_ACCOUNT_CHANGE',
            code: '123456',
            phone: '11999999999',
            expiresAt: new Date(Date.now() + 60_000)
        });
        await otps.save(otp);

        const verify = new VerifySchoolActionOtp(otps);
        const consume = new ConsumeSchoolActionOtp(otps);

        const verified = await verify.exec({
            schoolId: 'school-1',
            challengeId: otp.id,
            code: '123456'
        });

        expect(verified.verified).toBe(true);

        await consume.exec({
            schoolId: 'school-1',
            challengeId: otp.id,
            purpose: 'BANK_ACCOUNT_CHANGE'
        });

        const updated = await otps.findById(otp.id);
        expect(updated?.consumedAt).not.toBeNull();
    });
});
