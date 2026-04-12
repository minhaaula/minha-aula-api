import type { SchoolActionOtpWhatsAppTemplateConfig } from '../types/school.types';
import { SchoolActionOtp, type SchoolActionOtpPurpose } from '../../domain/entities/school-action-otp';
import { WhatsAppProviderPort } from '../../ports/providers/whatsapp-provider.port';
import { SchoolActionOtpRepository } from '../../ports/repositories/school-action-otp.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AppError, ErrorCode } from '../../shared/errors';
import { sanitizeForLogging } from '../../shared/log-sanitizer';
import { log } from '../../shared/logger';
import { Uuid } from '../../shared/uuid';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

export class RequestSchoolActionOtp {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly otps: SchoolActionOtpRepository,
        private readonly whatsapp?: WhatsAppProviderPort,
        /** Template Twilio Content (ex.: `message_opt_in`) — obrigatório quando `whatsapp` está configurado. */
        private readonly otpWhatsAppTemplate?: SchoolActionOtpWhatsAppTemplateConfig
    ) {}

    async exec(input: { schoolId: string; purpose: SchoolActionOtpPurpose }) {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.validation('Identificação da escola é obrigatória');
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        if (!school.phone?.trim()) {
            throw AppError.fromCode(ErrorCode.INCOMPLETE_DATA, {
                message: 'Escola não possui telefone cadastrado para receber OTP'
            });
        }

        if (!this.whatsapp) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message: 'Envio de OTP via WhatsApp não está configurado'
            });
        }

        const otpTemplate = this.otpWhatsAppTemplate;
        if (!otpTemplate?.contentSid?.trim()) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message:
                    'Template WhatsApp para OTP não está configurado (TWILIO_CONTENT_SID_MESSAGE_OPT_IN ou TWILIO_WHATSAPP_MESSAGE_OPT_IN_CONTENT_SID)'
            });
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
        const otp = SchoolActionOtp.create({
            id: Uuid(),
            schoolId,
            purpose: input.purpose,
            code,
            phone: school.phone,
            expiresAt,
            maxAttempts: OTP_MAX_ATTEMPTS
        });

        await this.otps.save(otp);
        const otpBody = `Seu codigo OTP para ${describePurpose(input.purpose)} e ${code}. Ele expira em ${OTP_TTL_MINUTES} minutos.`;
        await this.whatsapp.sendContentTemplate({
            to: school.phone,
            contentSid: otpTemplate.contentSid.trim(),
            /** Placeholder {{1}} no template Twilio `message_opt_in` (ou equivalente aprovado). */
            contentVariables: { '1': otpBody }
        });

        log.info('[SchoolActionOtp] OTP enviado', sanitizeForLogging({
            schoolId,
            purpose: input.purpose,
            challengeId: otp.id,
            expiresAt: otp.expiresAt.toISOString(),
            phone: school.phone
        }));

        return {
            challengeId: otp.id,
            purpose: otp.purpose,
            expiresAt: otp.expiresAt
        };
    }
}

function describePurpose(purpose: SchoolActionOtpPurpose): string {
    return purpose === 'WITHDRAWAL' ? 'confirmar o saque' : 'confirmar alteracoes bancarias';
}
