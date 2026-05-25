import type { TokenProviderPort } from '../../../ports/providers/token-provider.port';
import type { UserRepository } from '../../../ports/repositories/user.repo';
import type { AuthPhoneOtpChallengeRepository } from '../../../ports/repositories/auth-phone-otp-challenge.repo';
import type { TwilioVerifyPort } from '../../../ports/providers/twilio-verify.port';
import { AppError, ErrorCode } from '../../../shared/errors';
import { sanitizeForLogging } from '../../../shared/log-sanitizer';
import { log } from '../../../shared/logger';
import { toE164Brazil } from '../../../shared/phone-e164';
import { assertSchoolPersonaCannotUseStudentProfileRoutes } from './assert-school-persona-student-profile-fields';

const PROFILE_UPDATE_TOKEN_TTL_SEC = 15 * 60;

export interface VerifyStudentProfileUpdateOtpInput {
    userId: string;
    challengeId: string;
    code: string;
}

export interface VerifyStudentProfileUpdateOtpOutput {
    message: string;
    purpose: 'student_profile_update';
    challengeId: string;
    profileUpdateVerificationToken: string;
    /** E.164 do WhatsApp verificado neste desafio. */
    verifiedPhone: string;
}

/**
 * Valida o código OTP e emite token para concluir `PUT /students/me`.
 */
export class VerifyStudentProfileUpdateOtp {
    constructor(
        private readonly challenges: AuthPhoneOtpChallengeRepository,
        private readonly twilio: TwilioVerifyPort | undefined,
        private readonly tokenProvider: TokenProviderPort,
        private readonly users: UserRepository
    ) {}

    async exec(input: VerifyStudentProfileUpdateOtpInput): Promise<VerifyStudentProfileUpdateOtpOutput> {
        const userId = input.userId.trim();
        const challengeId = input.challengeId.trim();
        const code = input.code.trim();
        if (!userId || !challengeId || !code) {
            throw AppError.validation('challengeId e code são obrigatórios');
        }

        const user = await this.users.findById(userId);
        if (!user) {
            throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId });
        }
        assertSchoolPersonaCannotUseStudentProfileRoutes(user);

        const otp = await this.challenges.findById(challengeId);
        if (!otp || otp.purpose !== 'student_profile_update') {
            throw AppError.validation('Código inválido ou expirado');
        }

        if (otp.subjectUserId !== userId) {
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
            log.error('[PhoneOtp] Erro ao validar código (perfil aluno)', sanitizeForLogging({ e }));
            throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Não foi possível validar o código no momento');
        }

        const updated = otp.registerAttempt(success, new Date());
        await this.challenges.save(updated);

        if (!success) {
            log.warn('[PhoneOtp] Código inválido (perfil aluno)', sanitizeForLogging({
                challengeId,
                attemptsUsed: updated.attemptsUsed
            }));
            throw AppError.validation('Código inválido');
        }

        const consumed = updated.markConsumed(new Date());
        await this.challenges.save(consumed);

        const e164 = toE164Brazil(consumed.phone);
        if (!e164) {
            throw AppError.fromCode(ErrorCode.INVALID_PHONE, { phone: consumed.phone });
        }

        const profileUpdateVerificationToken = await this.tokenProvider.sign(
            { typ: 'student_profile_update', sub: userId, ph: e164, cid: consumed.id },
            { expiresIn: PROFILE_UPDATE_TOKEN_TTL_SEC }
        );

        log.info('[PhoneOtp] student_profile_update verificado', sanitizeForLogging({ challengeId, userId }));

        return {
            message: 'WhatsApp confirmado. Você já pode salvar as alterações do perfil.',
            purpose: 'student_profile_update',
            challengeId: consumed.id,
            profileUpdateVerificationToken,
            verifiedPhone: e164
        };
    }
}
