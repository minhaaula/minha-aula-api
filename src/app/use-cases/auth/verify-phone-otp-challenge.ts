import { randomBytes } from 'crypto';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token';
import type { AuthPhoneOtpPurpose } from '../../../domain/entities/auth-phone-otp-challenge';
import type { TokenProviderPort } from '../../../ports/providers/token-provider.port';
import type { AuthPhoneOtpChallengeRepository } from '../../../ports/repositories/auth-phone-otp-challenge.repo';
import type { PasswordResetTokenRepository } from '../../../ports/repositories/password-reset-token.repo';
import type { TwilioVerifyPort } from '../../../ports/providers/twilio-verify.port';
import { AppError, ErrorCode } from '../../../shared/errors';
import { sanitizeForLogging } from '../../../shared/log-sanitizer';
import { log } from '../../../shared/logger';
import { toE164Brazil } from '../../../shared/phone-e164';

const SIGNUP_TOKEN_TTL_SEC = 15 * 60;
const SCHOOL_SIGNUP_TOKEN_TTL_SEC = 15 * 60;

export type VerifyPhoneOtpResult =
    | {
          purpose: 'signup';
          phoneVerificationToken: string;
          challengeId: string;
      }
    | {
          purpose: 'school_signup';
          ownerWhatsappVerificationToken: string;
          challengeId: string;
      }
    | {
          purpose: 'user_password_reset';
          resetToken: string;
          challengeId: string;
      }
    | {
          purpose: 'school_password_reset';
          resetToken: string;
          challengeId: string;
      };

/**
 * Valida o código (Twilio Verify) e conclui o fluxo: token de cadastro ou token de reset de senha.
 */
export class VerifyPhoneOtpChallenge {
    constructor(
        private readonly challenges: AuthPhoneOtpChallengeRepository,
        private readonly twilio: TwilioVerifyPort | undefined,
        private readonly tokenProvider: TokenProviderPort,
        private readonly resetTokens?: PasswordResetTokenRepository
    ) {}

    async exec(input: { challengeId: string; code: string }): Promise<VerifyPhoneOtpResult> {
        const challengeId = input.challengeId.trim();
        const code = input.code.trim();
        if (!challengeId || !code) {
            throw AppError.validation('challengeId e code são obrigatórios');
        }

        const otp = await this.challenges.findById(challengeId);
        if (!otp) {
            throw AppError.validation('Código inválido ou expirado');
        }

        if (otp.isConsumed()) {
            throw AppError.validation('Este código já foi utilizado');
        }

        if (otp.isExpired()) {
            throw AppError.validation('Código expirado');
        }

        if (!otp.canAttempt()) {
            throw AppError.validation('Limite de tentativas excedido');
        }

        if (!otp.twilioVerificationSid) {
            throw AppError.fromCode(ErrorCode.OTP_SEND_PENDING);
        }

        if (!this.twilio) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message: 'Validação por WhatsApp não está disponível no servidor'
            });
        }

        let success: boolean;
        try {
            success = await this.twilio.checkVerification(otp.phone, code);
        } catch (e: unknown) {
            log.error('[PhoneOtp] Erro ao validar código no Twilio Verify', sanitizeForLogging({ e }));
            throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Não foi possível validar o código no momento');
        }

        const updated = otp.registerAttempt(success, new Date());
        await this.challenges.save(updated);

        if (!success) {
            log.warn('[PhoneOtp] Código inválido', sanitizeForLogging({
                challengeId,
                purpose: otp.purpose,
                attemptsUsed: updated.attemptsUsed
            }));
            throw AppError.validation('Código inválido');
        }

        const consumed = updated.markConsumed(new Date());
        await this.challenges.save(consumed);

        const purpose = consumed.purpose as AuthPhoneOtpPurpose;
        if (purpose === 'signup') {
            const e164 = toE164Brazil(consumed.phone);
            if (!e164) {
                throw AppError.fromCode(ErrorCode.INVALID_PHONE, { phone: consumed.phone });
            }
            const phoneVerificationToken = await this.tokenProvider.sign(
                { typ: 'signup_phone', ph: e164 },
                { expiresIn: SIGNUP_TOKEN_TTL_SEC }
            );
            log.info('[PhoneOtp] signup verificado', sanitizeForLogging({ challengeId }));
            return { purpose: 'signup', phoneVerificationToken, challengeId: consumed.id };
        }

        if (purpose === 'school_signup') {
            const e164 = toE164Brazil(consumed.phone);
            if (!e164) {
                throw AppError.fromCode(ErrorCode.INVALID_PHONE, { phone: consumed.phone });
            }
            const ownerWhatsappVerificationToken = await this.tokenProvider.sign(
                { typ: 'school_signup_phone', ph: e164 },
                { expiresIn: SCHOOL_SIGNUP_TOKEN_TTL_SEC }
            );
            log.info('[PhoneOtp] school_signup verificado', sanitizeForLogging({ challengeId }));
            return { purpose: 'school_signup', ownerWhatsappVerificationToken, challengeId: consumed.id };
        }

        const email = consumed.email;
        if (!email) {
            throw AppError.validation('Desafio inválido');
        }

        if (!this.resetTokens) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message: 'Reset de senha não está disponível no servidor'
            });
        }

        const token = this.generateResetToken();
        const tokenId = randomBytes(16).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        const resetToken = PasswordResetToken.create({
            id: tokenId,
            email,
            token,
            expiresAt
        });
        await this.resetTokens.save(resetToken);

        log.info('[PhoneOtp] reset de senha verificado', sanitizeForLogging({
            challengeId,
            purpose: consumed.purpose
        }));

        if (purpose === 'user_password_reset') {
            return { purpose: 'user_password_reset', resetToken: token, challengeId: consumed.id };
        }

        return { purpose: 'school_password_reset', resetToken: token, challengeId: consumed.id };
    }

    private generateResetToken(): string {
        return randomBytes(32).toString('hex');
    }
}
