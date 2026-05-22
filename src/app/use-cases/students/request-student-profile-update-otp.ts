import { AuthPhoneOtpChallenge } from '../../../domain/entities/auth-phone-otp-challenge';
import type { UserRepository } from '../../../ports/repositories/user.repo';
import type { AuthPhoneOtpChallengeRepository } from '../../../ports/repositories/auth-phone-otp-challenge.repo';
import type { OutboxRepository } from '../../../ports/repositories/outbox.repo';
import type { TwilioVerifyPort } from '../../../ports/providers/twilio-verify.port';
import { AppError, ErrorCode } from '../../../shared/errors';
import { sanitizeForLogging } from '../../../shared/log-sanitizer';
import { log } from '../../../shared/logger';
import { toE164Brazil } from '../../../shared/phone-e164';
import { Uuid } from '../../../shared/uuid';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const TWILIO_VERIFY_CODE_PLACEHOLDER = '000000';

export interface RequestStudentProfileUpdateOtpInput {
    userId: string;
    /** Novo WhatsApp; se informado, o código é enviado para este número. */
    phone?: string;
}

export interface RequestStudentProfileUpdateOtpOutput {
    message: string;
    challengeId: string;
    purpose: 'student_profile_update';
    expiresAt: string;
    /** E.164 do número que receberá o código. */
    phone: string;
}

/**
 * Inicia OTP por WhatsApp antes de alterar dados do perfil do aluno.
 * Se `phone` for informado (troca de WhatsApp), o código vai para o novo número.
 */
export class RequestStudentProfileUpdateOtp {
    constructor(
        private readonly challenges: AuthPhoneOtpChallengeRepository,
        private readonly users: UserRepository,
        private readonly twilio: TwilioVerifyPort | undefined,
        private readonly outbox: OutboxRepository | undefined
    ) {}

    async exec(input: RequestStudentProfileUpdateOtpInput): Promise<RequestStudentProfileUpdateOtpOutput> {
        if (!this.twilio) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message: 'Verificação por WhatsApp não está configurada (Twilio Verify)'
            });
        }
        if (!this.outbox) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message: 'Fila de envio de OTP não configurada (outbox)'
            });
        }

        const userId = input.userId.trim();
        if (!userId) {
            throw AppError.validation('Identificação do usuário é obrigatória');
        }

        const user = await this.users.findById(userId);
        if (!user) {
            throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId });
        }

        const targetE164 = this.resolveTargetPhoneE164(user.phone, input.phone);

        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
        const otp = AuthPhoneOtpChallenge.create({
            id: Uuid(),
            purpose: 'student_profile_update',
            code: TWILIO_VERIFY_CODE_PLACEHOLDER,
            phone: targetE164,
            email: null,
            subjectUserId: userId,
            expiresAt,
            maxAttempts: OTP_MAX_ATTEMPTS,
            twilioVerificationSid: null
        });
        await this.challenges.save(otp);
        await this.enqueuePhoneOtpSend(otp.id);

        log.info('[PhoneOtp] student_profile_update iniciado', sanitizeForLogging({
            challengeId: otp.id,
            userId,
            phone: targetE164
        }));

        return {
            message: 'O código será enviado ao WhatsApp em instantes.',
            challengeId: otp.id,
            purpose: 'student_profile_update',
            expiresAt: otp.expiresAt.toISOString(),
            phone: targetE164
        };
    }

    private resolveTargetPhoneE164(currentPhone: string, declaredPhone?: string): string {
        if (declaredPhone !== undefined && declaredPhone.trim() !== '') {
            const e164 = toE164Brazil(declaredPhone);
            if (!e164) {
                throw AppError.fromCode(ErrorCode.INVALID_PHONE, { phone: declaredPhone });
            }
            return e164;
        }

        const currentE164 = toE164Brazil(currentPhone);
        if (!currentE164) {
            throw AppError.fromCode(ErrorCode.INCOMPLETE_DATA, {
                message: 'Cadastre um WhatsApp válido ou informe o novo número para receber o código.'
            });
        }
        return currentE164;
    }

    private async enqueuePhoneOtpSend(challengeId: string): Promise<void> {
        try {
            await this.outbox!.enqueue({
                type: 'phone_otp_send',
                aggregateId: challengeId,
                payload: { challengeId }
            });
        } catch (e: unknown) {
            log.error('[PhoneOtp] Falha ao enfileirar envio OTP (perfil aluno)', sanitizeForLogging({ e, challengeId }));
            throw new AppError(
                ErrorCode.EXTERNAL_SERVICE_ERROR,
                'Não foi possível iniciar o envio do código. Verifique Redis e o worker.'
            );
        }
    }
}
