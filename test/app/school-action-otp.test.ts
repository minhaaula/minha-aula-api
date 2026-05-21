import { describe, expect, it } from 'vitest';
import { AppError, ErrorCode } from '../../src/shared/errors';
import { RequestSchoolActionOtp } from '../../src/app/use-cases/schools/request-school-action-otp';
import { VerifySchoolActionOtp } from '../../src/app/use-cases/schools/verify-school-action-otp';
import { ConsumeSchoolActionOtp } from '../../src/app/use-cases/shared/consume-school-action-otp';
import { SchoolActionOtp } from '../../src/domain/entities/school-action-otp';
import { School } from '../../src/domain/entities/school';
import type {
    SendWhatsAppContentTemplateInput,
    SendWhatsAppInput,
    WhatsAppProviderPort
} from '../../src/ports/providers/whatsapp-provider.port';
import type { TwilioVerifyPort } from '../../src/ports/providers/twilio-verify.port';
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
    it('requests an OTP and sends it to the owner WhatsApp (not the school phone)', async () => {
        const schools = new InMemorySchoolRepository();
        const otps = new InMemorySchoolActionOtpRepository();
        const whatsapp = new FakeWhatsAppProvider();
        const school = School.create({
            id: Uuid(),
            name: 'Escola OTP',
            email: 'otp@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190',
            ownerWhatsapp: '11888887777'
        });
        schools.seed(school);

        const useCase = new RequestSchoolActionOtp(schools, otps, whatsapp, {
            contentSid: 'HX00000000000000000000000000000001'
        });
        const result = await useCase.exec({ schoolId: school.id, purpose: 'WITHDRAWAL' });

        expect(result.challengeId).toBeTruthy();
        expect(result.purpose).toBe('WITHDRAWAL');
        expect(whatsapp.contentTemplates).toHaveLength(1);
        expect(whatsapp.contentTemplates[0]?.to).toBe('11888887777');
        expect(whatsapp.contentTemplates[0]?.contentSid).toBe('HX00000000000000000000000000000001');
        expect(whatsapp.contentTemplates[0]?.contentVariables['1']).toMatch(
            /^Seu codigo OTP para confirmar o saque e \d{6}\. Ele expira em 10 minutos\.$/
        );
    });

    it('requests OTP via Twilio Verify (WhatsApp) when verify port is configured', async () => {
        const schools = new InMemorySchoolRepository();
        const otps = new InMemorySchoolActionOtpRepository();
        let verifyTo = '';
        const fakeVerify: TwilioVerifyPort = {
            async sendVerification(rawPhone: string) {
                verifyTo = rawPhone;
                return { verificationSid: 'VEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', validUntil: null };
            },
            async checkVerification() {
                return true;
            }
        };
        const school = School.create({
            id: Uuid(),
            name: 'Escola Verify',
            email: 'verify@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190',
            ownerWhatsapp: '11777776666'
        });
        schools.seed(school);

        const useCase = new RequestSchoolActionOtp(schools, otps, undefined, undefined, fakeVerify);
        const result = await useCase.exec({ schoolId: school.id, purpose: 'WITHDRAWAL' });

        expect(result.challengeId).toBeTruthy();
        expect(verifyTo).toBe('11777776666');
        const saved = await otps.findById(result.challengeId);
        expect(saved?.twilioVerificationSid).toBe('VEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
        expect(saved?.code).toBe('000000');
        expect(saved?.phone).toBe('11777776666');
    });

    it('rejects OTP request when owner WhatsApp is not set', async () => {
        const schools = new InMemorySchoolRepository();
        const otps = new InMemorySchoolActionOtpRepository();
        const whatsapp = new FakeWhatsAppProvider();
        const school = School.create({
            id: Uuid(),
            name: 'Sem WhatsApp dono',
            email: 'sem@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190'
        });
        schools.seed(school);

        const useCase = new RequestSchoolActionOtp(schools, otps, whatsapp, {
            contentSid: 'HX00000000000000000000000000000001'
        });
        try {
            await useCase.exec({ schoolId: school.id, purpose: 'WITHDRAWAL' });
            expect.fail('deveria lançar INCOMPLETE_DATA');
        } catch (e) {
            expect(e).toBeInstanceOf(AppError);
            const app = e as AppError;
            expect(app.code).toBe(ErrorCode.INCOMPLETE_DATA);
            expect(String(app.details?.message)).toMatch(/WhatsApp do responsável/);
        }
        expect(whatsapp.contentTemplates).toHaveLength(0);
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

    it('validates Twilio Verify challenges via checkVerification', async () => {
        const otps = new InMemorySchoolActionOtpRepository();
        const fakeVerify: TwilioVerifyPort = {
            async sendVerification() {
                return { verificationSid: 'VEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', validUntil: null };
            },
            async checkVerification(_phone, code) {
                return code === '654321';
            }
        };
        const otp = SchoolActionOtp.create({
            id: Uuid(),
            schoolId: 'school-1',
            purpose: 'BANK_ACCOUNT_CHANGE',
            code: '000000',
            phone: '11999999999',
            expiresAt: new Date(Date.now() + 60_000),
            twilioVerificationSid: 'VEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        });
        await otps.save(otp);

        const verify = new VerifySchoolActionOtp(otps, fakeVerify);
        const verified = await verify.exec({
            schoolId: 'school-1',
            challengeId: otp.id,
            code: '654321'
        });

        expect(verified.verified).toBe(true);
    });
});
