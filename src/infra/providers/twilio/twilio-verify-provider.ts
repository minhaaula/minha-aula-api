import type { TwilioStartVerificationResult, TwilioVerifyPort } from '../../../ports/providers/twilio-verify.port';
import { sanitizeForLogging } from '../../../shared/log-sanitizer';
import { log } from '../../../shared/logger';
import { toE164Brazil } from '../../../shared/phone-e164';

/**
 * @see https://www.twilio.com/docs/verify/whatsapp
 */
export interface TwilioVerifyConfig {
    accountSid: string;
    authToken: string;
    /** Verify Service SID (VA…) */
    serviceSid: string;
}

export class TwilioVerifyProvider implements TwilioVerifyPort {
    private readonly client: import('twilio').Twilio;
    private readonly serviceSid: string;

    constructor(config: TwilioVerifyConfig) {
        this.serviceSid = config.serviceSid.trim();
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const twilio = require('twilio');
            this.client = twilio(config.accountSid, config.authToken);
        } catch (e) {
            throw new Error('Twilio não está instalado. Execute: npm install twilio');
        }
    }

    async sendVerification(rawPhone: string): Promise<TwilioStartVerificationResult> {
        const to = toE164Brazil(rawPhone);
        if (!to) {
            throw new Error('Telefone inválido para verificação Twilio');
        }
        try {
            const verification = await this.client.verify.v2.services(this.serviceSid).verifications.create({
                channel: 'whatsapp',
                to
            });
            const sid = verification.sid?.trim();
            if (!sid) {
                throw new Error('Twilio Verify não retornou SID da verificação');
            }
            log.info('[Twilio Verify] Verificação iniciada', sanitizeForLogging({ to, verificationSid: sid }));
            return {
                verificationSid: sid,
                validUntil: null
            };
        } catch (error: unknown) {
            log.error('[Twilio Verify] Erro ao iniciar verificação', sanitizeForLogging({ error }));
            throw error;
        }
    }

    async checkVerification(rawPhone: string, code: string): Promise<boolean> {
        const to = toE164Brazil(rawPhone);
        if (!to) {
            throw new Error('Telefone inválido para verificação Twilio');
        }
        const trimmed = (code ?? '').trim();
        if (!trimmed) {
            return false;
        }
        try {
            const result = await this.client.verify.v2.services(this.serviceSid).verificationChecks.create({
                to,
                code: trimmed
            });
            return result.status === 'approved';
        } catch (error: unknown) {
            log.error('[Twilio Verify] Erro ao validar código', sanitizeForLogging({ error }));
            throw error;
        }
    }
}
