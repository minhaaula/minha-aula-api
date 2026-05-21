import type { TwilioVerifyPort } from '../../../ports/providers/twilio-verify.port';
import { SchoolActionOtpRepository } from '../../../ports/repositories/school-action-otp.repo';
import { AppError, ErrorCode } from '../../../shared/errors';
import { sanitizeForLogging } from '../../../shared/log-sanitizer';
import { log } from '../../../shared/logger';

export class VerifySchoolActionOtp {
    constructor(
        private readonly otps: SchoolActionOtpRepository,
        private readonly twilioVerify?: TwilioVerifyPort
    ) {}

    async exec(input: { schoolId: string; challengeId: string; code: string }) {
        const schoolId = input.schoolId.trim();
        const challengeId = input.challengeId.trim();
        const code = input.code.trim();

        if (!schoolId || !challengeId || !code) {
            throw AppError.validation('schoolId, challengeId e code são obrigatórios');
        }

        const otp = await this.otps.findById(challengeId);
        if (!otp || otp.schoolId !== schoolId) {
            throw AppError.validation('OTP inválido');
        }

        if (otp.isConsumed()) {
            throw AppError.validation('OTP já utilizado');
        }

        if (otp.isExpired()) {
            throw AppError.validation('OTP expirado');
        }

        if (otp.isVerified()) {
            return {
                challengeId: otp.id,
                purpose: otp.purpose,
                verified: true,
                verifiedAt: otp.verifiedAt as Date
            };
        }

        if (!otp.canAttempt()) {
            log.warn('[SchoolActionOtp] Limite de tentativas excedido', sanitizeForLogging({
                schoolId,
                challengeId,
                purpose: otp.purpose,
                attemptsUsed: otp.attemptsUsed,
                maxAttempts: otp.maxAttempts
            }));
            throw AppError.validation('Limite de tentativas excedido');
        }

        let success: boolean;
        if (otp.twilioVerificationSid) {
            if (!this.twilioVerify) {
                throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                    message: 'Validação Twilio Verify não está disponível no servidor'
                });
            }
            try {
                success = await this.twilioVerify.checkVerification(otp.phone, code);
            } catch (e: unknown) {
                log.error('[SchoolActionOtp] Erro ao validar OTP no Twilio Verify', sanitizeForLogging({ e }));
                throw new AppError(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    'Não foi possível validar o código no momento'
                );
            }
        } else {
            success = otp.code === code;
        }

        const updated = otp.registerAttempt(success, new Date());
        await this.otps.save(updated);

        if (!success) {
            log.warn('[SchoolActionOtp] Código OTP inválido', sanitizeForLogging({
                schoolId,
                challengeId,
                purpose: otp.purpose,
                attemptsUsed: updated.attemptsUsed
            }));
            throw AppError.validation('Código OTP inválido');
        }

        log.info('[SchoolActionOtp] OTP validado com sucesso', sanitizeForLogging({
            schoolId,
            challengeId,
            purpose: otp.purpose
        }));

        return {
            challengeId: updated.id,
            purpose: updated.purpose,
            verified: true,
            verifiedAt: updated.verifiedAt as Date
        };
    }
}
