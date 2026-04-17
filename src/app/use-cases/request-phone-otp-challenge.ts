import { AuthPhoneOtpChallenge } from '../../domain/entities/auth-phone-otp-challenge';
import type { AuthPhoneOtpPurpose } from '../../domain/entities/auth-phone-otp-challenge';
import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { UserRepository } from '../../ports/repositories/user.repo';
import type { AuthPhoneOtpChallengeRepository } from '../../ports/repositories/auth-phone-otp-challenge.repo';
import type { TwilioVerifyPort } from '../../ports/providers/twilio-verify.port';
import { AppError, ErrorCode } from '../../shared/errors';
import { sanitizeForLogging } from '../../shared/log-sanitizer';
import { log } from '../../shared/logger';
import { toE164Brazil } from '../../shared/phone-e164';
import { Uuid } from '../../shared/uuid';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const TWILIO_VERIFY_CODE_PLACEHOLDER = '000000';

export type RequestPhoneOtpInput =
    | { purpose: 'signup'; phone: string }
    | { purpose: 'user_password_reset'; cpf: string }
    | { purpose: 'school_password_reset'; email: string };

export type RequestPhoneOtpOutput =
    | {
          message: string;
          challengeId: string;
          purpose: AuthPhoneOtpPurpose;
          expiresAt: string;
      }
    | {
          message: string;
      };

/**
 * Inicia verificação por WhatsApp (Twilio Verify) para cadastro ou recuperação de senha.
 */
export class RequestPhoneOtpChallenge {
    constructor(
        private readonly challenges: AuthPhoneOtpChallengeRepository,
        private readonly twilio: TwilioVerifyPort | undefined,
        private readonly users: UserRepository,
        private readonly schools: SchoolRepository | undefined
    ) {}

    async exec(input: RequestPhoneOtpInput): Promise<RequestPhoneOtpOutput> {
        if (!this.twilio) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message: 'Verificação por WhatsApp não está configurada (Twilio Verify)'
            });
        }

        if (input.purpose === 'signup') {
            return this.requestSignup(input.phone);
        }
        if (input.purpose === 'user_password_reset') {
            return this.requestUserPasswordReset(input.cpf);
        }
        return this.requestSchoolPasswordReset(input.email);
    }

    private async requestSignup(rawPhone: string): Promise<RequestPhoneOtpOutput> {
        const e164 = toE164Brazil(rawPhone);
        if (!e164) {
            throw AppError.fromCode(ErrorCode.INVALID_PHONE, { phone: rawPhone });
        }

        const started = await this.twilio!.sendVerification(rawPhone);
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
        const otp = AuthPhoneOtpChallenge.create({
            id: Uuid(),
            purpose: 'signup',
            code: TWILIO_VERIFY_CODE_PLACEHOLDER,
            phone: e164,
            email: null,
            expiresAt,
            maxAttempts: OTP_MAX_ATTEMPTS,
            twilioVerificationSid: started.verificationSid
        });
        await this.challenges.save(otp);

        log.info('[PhoneOtp] signup iniciado', sanitizeForLogging({
            challengeId: otp.id,
            phone: e164
        }));

        return {
            message: 'Código enviado ao WhatsApp.',
            challengeId: otp.id,
            purpose: 'signup',
            expiresAt: otp.expiresAt.toISOString()
        };
    }

    private normalizeCpf(value: string): string {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) {
            throw AppError.fromCode(ErrorCode.INVALID_CPF, { cpf: value });
        }
        return digits;
    }

    private async requestUserPasswordReset(cpfRaw: string): Promise<RequestPhoneOtpOutput> {
        const cpf = this.normalizeCpf(cpfRaw);
        const user = await this.users.findByCpf(cpf);
        const generic: RequestPhoneOtpOutput = {
            message:
                'Se o CPF estiver cadastrado e houver telefone para receber o código, você receberá um WhatsApp em instantes.'
        };

        if (!user) {
            return generic;
        }

        const email = user.email.value.trim().toLowerCase();

        const rawPhone = user.phone?.trim();
        if (!rawPhone) {
            return generic;
        }

        const e164 = toE164Brazil(rawPhone);
        if (!e164) {
            return generic;
        }

        const started = await this.twilio!.sendVerification(rawPhone);
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
        const otp = AuthPhoneOtpChallenge.create({
            id: Uuid(),
            purpose: 'user_password_reset',
            code: TWILIO_VERIFY_CODE_PLACEHOLDER,
            phone: e164,
            email,
            expiresAt,
            maxAttempts: OTP_MAX_ATTEMPTS,
            twilioVerificationSid: started.verificationSid
        });
        await this.challenges.save(otp);

        log.info('[PhoneOtp] reset de senha (usuário) iniciado', sanitizeForLogging({
            challengeId: otp.id,
            cpf: `${cpf.slice(0, 3)}***${cpf.slice(-2)}`
        }));

        return {
            message: 'Código enviado ao WhatsApp.',
            challengeId: otp.id,
            purpose: 'user_password_reset',
            expiresAt: otp.expiresAt.toISOString()
        };
    }

    private async requestSchoolPasswordReset(emailRaw: string): Promise<RequestPhoneOtpOutput> {
        const email = emailRaw.trim().toLowerCase();
        if (!this.schools?.findByOwnerEmail) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message: 'Recuperação de senha da escola não está disponível'
            });
        }

        const school = await this.schools.findByOwnerEmail(email);
        const generic: RequestPhoneOtpOutput = {
            message:
                'Se o e-mail estiver cadastrado e houver telefone para receber o código, você receberá um WhatsApp em instantes.'
        };

        if (!school) {
            return generic;
        }

        const rawPhone = school.phone?.trim();
        if (!rawPhone) {
            return generic;
        }

        const e164 = toE164Brazil(rawPhone);
        if (!e164) {
            return generic;
        }

        const started = await this.twilio!.sendVerification(rawPhone);
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
        const otp = AuthPhoneOtpChallenge.create({
            id: Uuid(),
            purpose: 'school_password_reset',
            code: TWILIO_VERIFY_CODE_PLACEHOLDER,
            phone: e164,
            email,
            expiresAt,
            maxAttempts: OTP_MAX_ATTEMPTS,
            twilioVerificationSid: started.verificationSid
        });
        await this.challenges.save(otp);

        log.info('[PhoneOtp] reset de senha (escola) iniciado', sanitizeForLogging({
            challengeId: otp.id,
            email
        }));

        return {
            message: 'Código enviado ao WhatsApp.',
            challengeId: otp.id,
            purpose: 'school_password_reset',
            expiresAt: otp.expiresAt.toISOString()
        };
    }
}
